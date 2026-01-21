'use client';

import { useMemo, useCallback } from 'react';
import FlowchartRenderer, { EdgeClickInfo, ConflictingEdgeInfo } from '@/components/FlowchartRenderer';
import NodeEditDialog, { NodeUpdateResult, CoverageInfo } from '@/components/NodeEditDialog';
import Sidebar from '@/components/Sidebar';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { getReachableQuestionNodes } from '@/domain/graphAnalysis';
import { useFlowchartState } from '@/lib/hooks/useFlowchartState';
import { useDialogState } from '@/lib/hooks/useDialogState';
import {
  FlowchartDefinition,
  CustomNode,
  NodeEntryRule,
} from '@/types/flowchart';

// 初期ノードID
const NODE_ID_1 = 'fewwqigivttlnc3c';
const NODE_ID_2 = 'y461yijjbnmrzhfd';
const NODE_ID_3 = 'rgoiwtcxdl994vi0';
const NODE_ID_4 = 'kcupm6k1vrjh3gvf';
const NODE_ID_5 = 'sq98x9qcj7fl3aft';

// 選択肢ID
const CHOICE_1_OPT1 = 'monmvobuochf27jg';
const CHOICE_1_OPT2 = 'zz4tyzxqdi242pju';
const CHOICE_1_OPT3 = 'lo8v8ho66yi4j2l7';
const CHOICE_2_YES = 'oamoe6ag2vv5w4yo';
const CHOICE_2_NO = 'cn2w5ayuhun804cg';

// 初期ノードデータ（entryRules 形式）
const initialNodes: CustomNode[] = [
  {
    id: NODE_ID_1,
    label: "Node 1",
    shape: "rectangle",
    questionCategory: "SA",
    choices: [
      { id: CHOICE_1_OPT1, label: "選択肢1" },
      { id: CHOICE_1_OPT2, label: "選択肢2" },
      { id: CHOICE_1_OPT3, label: "選択肢3" },
    ],
    entryRules: [], // ルートノード
  },
  {
    id: NODE_ID_2,
    label: "Node 2",
    shape: "rectangle",
    questionCategory: "SA",
    choices: [
      { id: CHOICE_2_YES, label: "Yes" },
      { id: CHOICE_2_NO, label: "No" },
    ],
    entryRules: [
      {
        id: 'rule-node2-1',
        sourceNodeId: NODE_ID_1,
        label: "選択肢1, 選択肢2",
        style: "solid",
        visibilityCondition: {
          type: 'choice',
          choiceIds: [CHOICE_1_OPT1, CHOICE_1_OPT2],
        },
      },
    ],
  },
  {
    id: NODE_ID_3,
    label: "Node 3",
    shape: "rectangle",
    entryRules: [
      {
        id: 'rule-node3-1',
        sourceNodeId: NODE_ID_2,
        label: "Node 2: Yes AND Node 1: 選択肢1, 選択肢2",
        style: "solid",
        visibilityCondition: {
          type: 'compound',
          compound: {
            conditions: [
              { nodeId: NODE_ID_2, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_2_YES] } },
              { nodeId: NODE_ID_1, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_1_OPT1, CHOICE_1_OPT2] } },
            ],
            operator: "AND",
          },
        },
      },
    ],
  },
  {
    id: NODE_ID_4,
    label: "Node 4",
    shape: "rectangle",
    entryRules: [
      {
        id: 'rule-node4-1',
        sourceNodeId: NODE_ID_2,
        label: "Node 2: Yes AND Node 1: 選択肢2",
        style: "solid",
        visibilityCondition: {
          type: 'compound',
          compound: {
            conditions: [
              { nodeId: NODE_ID_2, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_2_YES] } },
              { nodeId: NODE_ID_1, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_1_OPT2] } },
            ],
            operator: "AND",
          },
        },
      },
    ],
  },
  {
    id: NODE_ID_5,
    label: "Node 5",
    shape: "rectangle",
    entryRules: [
      {
        id: 'rule-node5-1',
        sourceNodeId: NODE_ID_2,
        label: "No",
        style: "solid",
        visibilityCondition: {
          type: 'choice',
          choiceIds: [CHOICE_2_NO],
        },
      },
    ],
  },
];

export default function Home() {
  // フローチャート状態管理
  const flowchartState = useFlowchartState(initialNodes);
  const {
    nodes: customNodes,
    edges: customEdges,
    setNodes: setCustomNodes,
    editingChoicesIndex,
    coverageResults,
    coverageMap,
    conflictMap,
    compoundCoverageMap,
    compoundCoverageResults,
    addNode: handleAddNode,
    updateNode: handleUpdateNodeDirect,
    removeNode: handleRemoveNode,
    toggleChoicesEdit: handleToggleChoicesEdit,
    addChoice: handleAddChoice,
    removeChoice: handleRemoveChoice,
    updateChoice: handleUpdateChoice,
    addEntryRule,
    updateEntryRule,
    removeEntryRule,
  } = flowchartState;

  // ダイアログ状態管理
  const dialogState = useDialogState(customNodes, customEdges);
  const {
    isNodeDialogOpen,
    selectedSourceNode,
    reachableConditionNodes,
    openNodeDialog,
    closeNodeDialog,
  } = dialogState;

  // フローチャート定義
  const currentDefinition = useMemo((): FlowchartDefinition => {
    return {
      direction: 'TD' as const,
      nodes: customNodes,
      edges: customEdges,
    };
  }, [customNodes, customEdges]);

  // Mermaid文字列を生成
  const mermaidCode = useMemo(() => {
    return FlowchartGenerator.generate(currentDefinition);
  }, [currentDefinition]);

  // 競合エッジ情報を生成
  const conflictingEdges = useMemo((): ConflictingEdgeInfo[] => {
    const edges: ConflictingEdgeInfo[] = [];
    for (const [nodeId, conflicts] of conflictMap) {
      for (const conflict of conflicts) {
        // 競合しているエッジを両方追加
        edges.push({
          label: conflict.edge1.label,
          fromNodeId: nodeId,
          toNodeId: conflict.edge1.to,
        });
        edges.push({
          label: conflict.edge2.label,
          fromNodeId: nodeId,
          toNodeId: conflict.edge2.to,
        });
      }
    }
    // 重複を除去
    const uniqueEdges = edges.filter((edge, index, self) =>
      index === self.findIndex(e =>
        e.label === edge.label && e.fromNodeId === edge.fromNodeId && e.toNodeId === edge.toNodeId
      )
    );
    return uniqueEdges;
  }, [conflictMap]);

  // ========== イベントハンドラ ==========

  // ノードクリック時のハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    let node = currentDefinition.nodes.find(n => n.id === nodeId);
    if (!node) {
      node = currentDefinition.nodes.find(n => n.label === nodeId);
    }

    if (node) {
      const reachableNodes = getReachableQuestionNodes(node.id, customNodes, customEdges);
      openNodeDialog(node, reachableNodes);
    }
  }, [currentDefinition.nodes, customNodes, customEdges, openNodeDialog]);

  // エッジクリック時のハンドラ（エッジをクリックすると対象ノードのダイアログを開く）
  const handleEdgeClick = useCallback((edgeInfo: EdgeClickInfo) => {
    // エッジの to ノードを見つけてダイアログを開く
    if (edgeInfo.toNodeId) {
      const node = customNodes.find(n => n.id === edgeInfo.toNodeId);
      if (node) {
        const reachableNodes = getReachableQuestionNodes(node.id, customNodes, customEdges);
        openNodeDialog(node, reachableNodes);
      }
    }
  }, [customNodes, customEdges, openNodeDialog]);

  // ノード更新のハンドラ（ダイアログから）
  const handleUpdateNode = useCallback((nodeId: string, update: NodeUpdateResult) => {
    setCustomNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      const updatedNode: CustomNode = { ...node, label: update.label };
      if (update.questionCategory) {
        updatedNode.questionCategory = update.questionCategory;
        if (update.choices) {
          updatedNode.choices = update.choices;
        }
      } else {
        delete updatedNode.questionCategory;
        delete updatedNode.choices;
      }
      return updatedNode;
    }));
  }, [setCustomNodes]);

  // ノード削除のハンドラ
  const handleDeleteNode = useCallback((nodeId: string) => {
    const nodeIndex = customNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex !== -1) {
      handleRemoveNode(nodeIndex);
    }
  }, [customNodes, handleRemoveNode]);

  // EntryRule 追加のハンドラ
  const handleAddEntryRule = useCallback((nodeId: string, rule: Omit<NodeEntryRule, 'id'>) => {
    addEntryRule(nodeId, rule);
    closeNodeDialog();
  }, [addEntryRule, closeNodeDialog]);

  // ========== レンダリング ==========

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flowchart Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            JavaScript Object から Mermaid フローチャートを生成 ・ ノードをクリックして編集
          </p>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左パネル: サイドバー */}
        <Sidebar
          nodes={customNodes}
          coverageMap={coverageMap}
          conflictMap={conflictMap}
          compoundCoverageMap={compoundCoverageMap}
          editingChoicesIndex={editingChoicesIndex}
          onAddNode={handleAddNode}
          onUpdateNode={handleUpdateNodeDirect}
          onRemoveNode={handleRemoveNode}
          onToggleChoicesEdit={handleToggleChoicesEdit}
          onAddChoice={handleAddChoice}
          onRemoveChoice={handleRemoveChoice}
          onUpdateChoice={handleUpdateChoice}
          edges={customEdges}
          mermaidCode={mermaidCode}
        />

        {/* 右パネル: プレビュー */}
        <div className="flex-1 p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">プレビュー（ノード/エッジをクリックして編集）</h2>
          <div className="bg-white rounded-lg shadow-sm h-[calc(100%-40px)]">
            <FlowchartRenderer
              mermaidCode={mermaidCode}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              uncoveredNodeIds={[
                ...coverageResults.filter(r => !r.isCovered).map(r => r.nodeId),
                ...compoundCoverageResults.filter(r => !r.isFullyCovered).map(r => r.nodeId),
              ].filter((id, index, self) => self.indexOf(id) === index)}
              conflictingEdges={conflictingEdges}
            />
          </div>
        </div>
      </div>

      {/* ノード編集ダイアログ */}
      <NodeEditDialog
        isOpen={isNodeDialogOpen}
        onClose={closeNodeDialog}
        sourceNode={selectedSourceNode ? {
          ...selectedSourceNode,
          questionCategory: customNodes.find(n => n.id === selectedSourceNode.id)?.questionCategory,
          choices: customNodes.find(n => n.id === selectedSourceNode.id)?.choices,
          entryRules: customNodes.find(n => n.id === selectedSourceNode.id)?.entryRules,
        } : null}
        availableNodes={currentDefinition.nodes}
        conditionNodes={reachableConditionNodes}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onAddEntryRule={handleAddEntryRule}
        onUpdateEntryRule={updateEntryRule}
        onRemoveEntryRule={removeEntryRule}
        coverageInfo={selectedSourceNode ? (() => {
          const coverage = coverageMap.get(selectedSourceNode.id);
          if (!coverage) return undefined;
          return {
            unusedChoices: coverage.unusedChoices,
            isCovered: coverage.isCovered,
            hasOutgoingEdges: coverage.hasOutgoingEdges,
            outgoingEdgeCount: coverage.outgoingEdgeCount,
            questionCategory: coverage.questionCategory,
            numericGaps: coverage.numericGaps,
          } as CoverageInfo;
        })() : undefined}
        edgeConflicts={selectedSourceNode ? conflictMap.get(selectedSourceNode.id) : undefined}
      />
    </div>
  );
}
