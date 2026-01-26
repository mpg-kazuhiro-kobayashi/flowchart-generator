'use client';

import { useMemo, useCallback, useState } from 'react';
import FlowchartRenderer, { EdgeClickInfo, ConflictingEdgeInfo } from '@/components/FlowchartRenderer';
import NodeEditDialog, { NodeUpdateResult, CoverageInfo } from '@/components/NodeEditDialog';
import EntryRuleEditDialog from '@/components/EntryRuleEditDialog';
import Sidebar from '@/components/Sidebar';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { useFlowchartState } from '@/lib/hooks/useFlowchartState';
import { useDialogState } from '@/lib/hooks/useDialogState';
import {
  FlowchartDefinition,
  CustomNode,
  FlowchartNode,
  NodeEntryRule,
} from '@/types/flowchart';

// 初期ノードID
const NODE_ID_START = 'start-node';
const NODE_ID_END = 'exit-node';

// 初期ノードデータ（開始ノードと終了ノードのみ）
const initialNodes: CustomNode[] = [
  {
    id: NODE_ID_START,
    label: "開始",
    shape: "trapezoid",
    nodeType: "start",
    entryRules: [],
  },
  {
    id: NODE_ID_END,
    label: "終了",
    shape: "trapezoidAlt",
    nodeType: "end",
    entryRules: [
      {
        id: 'rule-end-1',
        sourceNodeId: NODE_ID_START,
        style: "solid",
        visibilityCondition: { type: 'default' },
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
    addEndNode: handleAddEndNode,
    updateNode: handleUpdateNodeDirect,
    removeNode: handleRemoveNode,
    canRemoveNode,
    toggleChoicesEdit: handleToggleChoicesEdit,
    addChoice: handleAddChoice,
    removeChoice: handleRemoveChoice,
    updateChoice: handleUpdateChoice,
    addEntryRule,
    updateEntryRule,
    removeEntryRule,
  } = flowchartState;

  // ダイアログ状態管理
  const dialogState = useDialogState();
  const {
    isNodeDialogOpen,
    selectedSourceNode,
    openNodeDialog,
    closeNodeDialog,
  } = dialogState;

  // エッジクリック時の到達ルール編集ダイアログ状態
  const [entryRuleDialogInfo, setEntryRuleDialogInfo] = useState<{
    targetNodeId: string;
    targetNodeLabel: string;
    rule: NodeEntryRule;
  } | null>(null);

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
      openNodeDialog(node);
    }
  }, [currentDefinition.nodes, openNodeDialog]);

  // エッジクリック時のハンドラ（エッジのラベルをクリックすると到達ルール編集ダイアログを開く）
  const handleEdgeClick = useCallback((edgeInfo: EdgeClickInfo) => {
    if (!edgeInfo.toNodeId || !edgeInfo.fromNodeId) return;

    // toNode を見つける
    const toNode = customNodes.find(n => n.id === edgeInfo.toNodeId);
    if (!toNode || !toNode.entryRules) return;

    // edgeIndex を使って customEdges から該当するエッジを特定し、
    // 同じ from/to のルールが複数ある場合は順序で区別する
    const clickedEdge = customEdges[edgeInfo.edgeIndex];
    if (!clickedEdge) return;

    // 同じ from/to ペアを持つエッジのうち、何番目かを特定
    const sameFromToEdges = customEdges.filter(
      (e, i) => i <= edgeInfo.edgeIndex && e.from === edgeInfo.fromNodeId && e.to === edgeInfo.toNodeId
    );
    const edgeOrderIndex = sameFromToEdges.length - 1;

    // 同じ sourceNodeId を持つルールの中から該当するものを特定
    const matchingRules = toNode.entryRules.filter(r => r.sourceNodeId === edgeInfo.fromNodeId);
    const rule = matchingRules[edgeOrderIndex];

    if (rule) {
      setEntryRuleDialogInfo({
        targetNodeId: toNode.id,
        targetNodeLabel: toNode.label,
        rule,
      });
    }
  }, [customNodes, customEdges]);

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

  // エッジクリック用の availableNodes（対象ノード自身と終了ノードを除く）
  // 終了ノードは接続元として選択不可
  const entryRuleDialogAvailableNodes = useMemo((): FlowchartNode[] => {
    if (!entryRuleDialogInfo) return [];
    return customNodes.filter(n =>
      n.id !== entryRuleDialogInfo.targetNodeId && n.nodeType !== 'end'
    );
  }, [entryRuleDialogInfo, customNodes]);

  // 到達ルール編集ダイアログを閉じる
  const closeEntryRuleDialog = useCallback(() => {
    setEntryRuleDialogInfo(null);
  }, []);

  // 到達ルール編集ダイアログからの更新ハンドラ
  const handleEntryRuleDialogUpdate = useCallback((nodeId: string, ruleId: string, updates: Partial<NodeEntryRule>) => {
    updateEntryRule(nodeId, ruleId, updates);
    closeEntryRuleDialog();
  }, [updateEntryRule, closeEntryRuleDialog]);

  // 到達ルール編集ダイアログからの削除ハンドラ
  const handleEntryRuleDialogDelete = useCallback((nodeId: string, ruleId: string) => {
    removeEntryRule(nodeId, ruleId);
    closeEntryRuleDialog();
  }, [removeEntryRule, closeEntryRuleDialog]);

  // ========== サイドバー表示状態 ==========
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // ========== レンダリング ==========

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Flowchart Generator</h1>
            <p className="text-sm text-gray-500 mt-1">
              JavaScript Object から Mermaid フローチャートを生成 ・ ノードをクリックして編集
            </p>
          </div>
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            {isSidebarVisible ? (
              <>
                <span>◀</span>
                <span>サイドバーを閉じる</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>サイドバーを開く</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左パネル: サイドバー */}
        {isSidebarVisible && <Sidebar
          nodes={customNodes}
          coverageMap={coverageMap}
          conflictMap={conflictMap}
          compoundCoverageMap={compoundCoverageMap}
          editingChoicesIndex={editingChoicesIndex}
          onAddNode={handleAddNode}
          onAddEndNode={handleAddEndNode}
          onUpdateNode={handleUpdateNodeDirect}
          onRemoveNode={handleRemoveNode}
          canRemoveNode={canRemoveNode}
          onToggleChoicesEdit={handleToggleChoicesEdit}
          onAddChoice={handleAddChoice}
          onRemoveChoice={handleRemoveChoice}
          onUpdateChoice={handleUpdateChoice}
          mermaidCode={mermaidCode}
        />}

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
              onAddNode={handleAddNode}
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
          nodeType: customNodes.find(n => n.id === selectedSourceNode.id)?.nodeType,
          questionCategory: customNodes.find(n => n.id === selectedSourceNode.id)?.questionCategory,
          choices: customNodes.find(n => n.id === selectedSourceNode.id)?.choices,
          entryRules: customNodes.find(n => n.id === selectedSourceNode.id)?.entryRules,
        } : null}
        availableNodes={currentDefinition.nodes}
        allNodes={customNodes}
        allEdges={customEdges}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        canDeleteNode={(nodeId) => {
          const nodeIndex = customNodes.findIndex(n => n.id === nodeId);
          return nodeIndex !== -1 && canRemoveNode(nodeIndex);
        }}
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

      {/* 到達ルール編集ダイアログ（エッジクリック時） */}
      <EntryRuleEditDialog
        isOpen={entryRuleDialogInfo !== null}
        onClose={closeEntryRuleDialog}
        targetNodeId={entryRuleDialogInfo?.targetNodeId ?? ''}
        targetNodeLabel={entryRuleDialogInfo?.targetNodeLabel ?? ''}
        rule={entryRuleDialogInfo?.rule ?? { id: '', sourceNodeId: '', style: 'solid', visibilityCondition: { type: 'default' } }}
        availableNodes={entryRuleDialogAvailableNodes}
        allNodes={customNodes}
        allEdges={customEdges}
        onUpdateRule={handleEntryRuleDialogUpdate}
        onDeleteRule={handleEntryRuleDialogDelete}
      />
    </div>
  );
}
