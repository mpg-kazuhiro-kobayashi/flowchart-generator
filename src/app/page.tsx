'use client';

import { useMemo, useCallback } from 'react';
import FlowchartRenderer, { EdgeClickInfo, ConflictingEdgeInfo } from '@/components/FlowchartRenderer';
import NodeEditDialog, { AddConditionResult, NodeUpdateResult, CoverageInfo } from '@/components/NodeEditDialog';
import EdgeEditDialog, { EdgeUpdateResult } from '@/components/EdgeEditDialog';
import Sidebar from '@/components/Sidebar';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { getReachableQuestionNodes } from '@/domain/graphAnalysis';
import { generateCompoundConditionLabel } from '@/domain/compoundCondition';
import { useFlowchartState } from '@/lib/hooks/useFlowchartState';
import { useDialogState } from '@/lib/hooks/useDialogState';
import {
  FlowchartDefinition,
  CustomNode,
  CustomEdge,
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

// 初期ノードデータ
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
  },
  { id: NODE_ID_3, label: "Node 3", shape: "rectangle" },
  { id: NODE_ID_4, label: "Node 4", shape: "rectangle" },
  { id: NODE_ID_5, label: "Node 5", shape: "rectangle" },
];

// 初期エッジデータ
const initialEdges: CustomEdge[] = [
  { from: NODE_ID_1, to: NODE_ID_2, label: "選択肢1, 選択肢2", style: "solid" },
  {
    from: NODE_ID_2,
    to: NODE_ID_3,
    label: "Node 2: Yes AND Node 1: 選択肢1, 選択肢2",
    style: "solid",
    compoundCondition: {
      conditions: [
        { nodeId: NODE_ID_2, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_2_YES] } },
        { nodeId: NODE_ID_1, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_1_OPT1, CHOICE_1_OPT2] } },
      ],
      operator: "AND",
    },
  },
  {
    from: NODE_ID_2,
    to: NODE_ID_4,
    label: "Node 2: Yes AND Node 1: 選択肢3, 選択肢2",
    style: "solid",
    compoundCondition: {
      conditions: [
        { nodeId: NODE_ID_2, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_2_YES] } },
        { nodeId: NODE_ID_1, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_1_OPT3, CHOICE_1_OPT2] } },
      ],
      operator: "AND",
    },
  },
  { from: NODE_ID_2, to: NODE_ID_5, label: "No", style: "solid" },
];

export default function Home() {
  // フローチャート状態管理
  const flowchartState = useFlowchartState(initialNodes, initialEdges);
  const {
    nodes: customNodes,
    edges: customEdges,
    setNodes: setCustomNodes,
    setEdges: setCustomEdges,
    editingChoicesIndex,
    coverageResults,
    coverageMap,
    conflictMap,
    addNode: handleAddNode,
    updateNode: handleUpdateNodeDirect,
    removeNode: handleRemoveNode,
    toggleChoicesEdit: handleToggleChoicesEdit,
    addChoice: handleAddChoice,
    removeChoice: handleRemoveChoice,
    updateChoice: handleUpdateChoice,
    addEdge: handleAddEdge,
    updateEdge: handleUpdateEdgeDirect,
    removeEdge: handleRemoveEdge,
  } = flowchartState;

  // ダイアログ状態管理
  const dialogState = useDialogState(customNodes, customEdges);
  const {
    isNodeDialogOpen,
    selectedSourceNode,
    reachableConditionNodes,
    openNodeDialog,
    closeNodeDialog,
    isEdgeDialogOpen,
    selectedEdgeIndex,
    selectedEdge,
    selectedEdgeSourceNode,
    selectedEdgeConditionNodes,
    openEdgeDialog,
    closeEdgeDialog,
    setSelectedEdgeIndex,
  } = dialogState;

  // フローチャート定義
  const currentDefinition = useMemo((): FlowchartDefinition => {
    return {
      direction: 'TD' as const,
      nodes: customNodes,
      edges: customEdges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.label || undefined,
        style: e.style,
      })),
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

  // 条件追加のハンドラ
  const handleAddCondition = useCallback((result: AddConditionResult) => {
    if (!selectedSourceNode) return;

    if (result.createNewNode) {
      setCustomNodes(prev => [...prev, {
        id: result.createNewNode!.id,
        label: result.createNewNode!.label,
        shape: 'rectangle',
      }]);
    }

    // 複合条件をエッジに直接設定
    if (result.compoundCondition && result.compoundCondition.conditions.length > 0) {
      const compoundLabel = generateCompoundConditionLabel(result.compoundCondition, customNodes);

      setCustomEdges(prev => [...prev, {
        from: selectedSourceNode.id,
        to: result.targetNodeId,
        label: compoundLabel,
        style: result.style,
        compoundCondition: result.compoundCondition,
      }]);
    } else {
      setCustomEdges(prev => [...prev, {
        from: selectedSourceNode.id,
        to: result.targetNodeId,
        label: result.label,
        style: result.style,
        condition: result.condition,
      }]);
    }

    closeNodeDialog();
  }, [selectedSourceNode, customNodes, setCustomNodes, setCustomEdges, closeNodeDialog]);

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
    // このノードに関連するエッジを削除
    const newEdges = customEdges.filter(edge =>
      edge.from !== nodeId && edge.to !== nodeId
    );

    // ノードを削除
    const newNodes = customNodes.filter(node => node.id !== nodeId);

    setCustomNodes(newNodes);
    setCustomEdges(newEdges);
  }, [customNodes, customEdges, setCustomNodes, setCustomEdges]);

  // エッジクリック時のハンドラ
  const handleEdgeClick = useCallback((edgeInfo: EdgeClickInfo) => {
    let edgeIndex: number | null = null;

    if (edgeInfo.label) {
      const foundIndex = customEdges.findIndex(e => e.label === edgeInfo.label);
      if (foundIndex !== -1) edgeIndex = foundIndex;
    }

    if (edgeIndex === null && edgeInfo.fromNodeId && edgeInfo.toNodeId) {
      const foundIndex = customEdges.findIndex(
        e => e.from === edgeInfo.fromNodeId && e.to === edgeInfo.toNodeId
      );
      if (foundIndex !== -1) edgeIndex = foundIndex;
    }

    if (edgeIndex === null && edgeInfo.edgeIndex >= 0 && edgeInfo.edgeIndex < customEdges.length) {
      edgeIndex = edgeInfo.edgeIndex;
    }

    if (edgeIndex !== null) {
      openEdgeDialog(edgeIndex);
    }
  }, [customEdges, openEdgeDialog]);

  // エッジ更新のハンドラ（ダイアログから）
  const handleUpdateEdge = useCallback((update: EdgeUpdateResult) => {
    if (selectedEdgeIndex === null) return;
    setCustomEdges(prev => prev.map((edge, index) => {
      if (index !== selectedEdgeIndex) return edge;
      return {
        ...edge,
        label: update.label,
        style: update.style,
        condition: update.condition,
        compoundCondition: update.compoundCondition,
      };
    }));
  }, [selectedEdgeIndex, setCustomEdges]);

  // エッジ削除のハンドラ（ダイアログから）
  const handleDeleteEdge = useCallback(() => {
    if (selectedEdgeIndex === null) return;
    setCustomEdges(prev => prev.filter((_, index) => index !== selectedEdgeIndex));
    setSelectedEdgeIndex(null);
  }, [selectedEdgeIndex, setCustomEdges, setSelectedEdgeIndex]);

  // ========== レンダリング ==========

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flowchart Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            JavaScript Object から Mermaid フローチャートを生成 ・ ノードをクリックして条件を追加
          </p>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左パネル: サイドバー */}
        <Sidebar
          nodes={customNodes}
          coverageMap={coverageMap}
          conflictMap={conflictMap}
          editingChoicesIndex={editingChoicesIndex}
          onAddNode={handleAddNode}
          onUpdateNode={handleUpdateNodeDirect}
          onRemoveNode={handleRemoveNode}
          onToggleChoicesEdit={handleToggleChoicesEdit}
          onAddChoice={handleAddChoice}
          onRemoveChoice={handleRemoveChoice}
          onUpdateChoice={handleUpdateChoice}
          edges={customEdges}
          onAddEdge={handleAddEdge}
          onUpdateEdge={handleUpdateEdgeDirect}
          onRemoveEdge={handleRemoveEdge}
          currentDefinition={currentDefinition}
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
              uncoveredNodeIds={coverageResults.filter(r => !r.isCovered).map(r => r.nodeId)}
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
        } : null}
        availableNodes={currentDefinition.nodes}
        conditionNodes={reachableConditionNodes}
        onAddCondition={handleAddCondition}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
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

      {/* エッジ編集ダイアログ */}
      <EdgeEditDialog
        isOpen={isEdgeDialogOpen}
        onClose={closeEdgeDialog}
        edge={selectedEdge}
        sourceNode={selectedEdgeSourceNode}
        conditionNodes={selectedEdgeConditionNodes}
        onUpdateEdge={handleUpdateEdge}
        onDeleteEdge={handleDeleteEdge}
      />
    </div>
  );
}
