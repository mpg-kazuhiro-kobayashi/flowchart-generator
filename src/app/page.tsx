'use client';

import { useMemo, useCallback } from 'react';
import FlowchartRenderer, { EdgeClickInfo } from '@/components/FlowchartRenderer';
import NodeEditDialog, { AddConditionResult, NodeUpdateResult, CoverageInfo } from '@/components/NodeEditDialog';
import EdgeEditDialog, { EdgeUpdateResult, CompoundConditionUpdateResult } from '@/components/EdgeEditDialog';
import Sidebar from '@/components/Sidebar';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { getReachableQuestionNodes } from '@/domain/graphAnalysis';
import { generateStateNodeId, generateStateNodeLabel, generateCompoundConditionEdgeLabel } from '@/domain/compoundCondition';
import { useFlowchartState } from '@/lib/hooks/useFlowchartState';
import { useDialogState } from '@/lib/hooks/useDialogState';
import {
  FlowchartDefinition,
  CustomNode,
  CustomEdge,
  isStateNode,
} from '@/types/flowchart';

// 初期ノードID（固定値 - SSR/CSR で一貫性を保つため）
// 新規作成時は generateUUID() で動的に生成される
const NODE_ID_A = 'node_a1b2c3d4e5f6';
const NODE_ID_B = 'node_b2c3d4e5f6g7';
const NODE_ID_C = 'node_c3d4e5f6g7h8';
const NODE_ID_E = 'node_e5f6g7h8i9j0';
const NODE_ID_G = 'node_g7h8i9j0k1l2';

// 選択肢ID（固定値）
const CHOICE_A_OPT1 = 'choice_a1opt1xxxxx';
const CHOICE_A_OPT2 = 'choice_a1opt2xxxxx';
const CHOICE_A_OPT3 = 'choice_a1opt3xxxxx';
const CHOICE_B_OPT1 = 'choice_b1opt1xxxxx';
const CHOICE_B_OPT2 = 'choice_b1opt2xxxxx';

// 状態ノードID
const STATE_NODE_1 = `_state_${NODE_ID_A}_${CHOICE_A_OPT1}_${CHOICE_A_OPT2}_${NODE_ID_B}_${CHOICE_B_OPT1}`;
const STATE_NODE_2 = `_state_${NODE_ID_A}_${CHOICE_A_OPT3}_${NODE_ID_B}_${CHOICE_B_OPT1}`;

// 初期ノードデータ
const initialNodes: CustomNode[] = [
  {
    id: NODE_ID_A,
    label: "Node A",
    shape: "rectangle",
    questionCategory: "MA",
    choices: [
      { id: CHOICE_A_OPT1, label: "選択肢1" },
      { id: CHOICE_A_OPT2, label: "選択肢2" },
      { id: CHOICE_A_OPT3, label: "選択肢3" },
    ],
  },
  {
    id: NODE_ID_B,
    label: "Node B",
    shape: "rectangle",
    questionCategory: "SA",
    choices: [
      { id: CHOICE_B_OPT1, label: "YES" },
      { id: CHOICE_B_OPT2, label: "NO" },
    ],
  },
  { id: NODE_ID_C, label: "Node C", shape: "rectangle" },
  {
    id: STATE_NODE_1,
    label: "Node A: 選択肢1, 選択肢2 AND Node B: YES",
    shape: "hexagon",
    compoundCondition: {
      conditions: [
        { nodeId: NODE_ID_A, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_A_OPT1, CHOICE_A_OPT2] } },
        { nodeId: NODE_ID_B, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_B_OPT1] } },
      ],
      operator: "AND",
    },
  },
  { id: NODE_ID_E, label: "Node E", shape: "rectangle" },
  {
    id: STATE_NODE_2,
    label: "Node A: 選択肢3 AND Node B: YES",
    shape: "hexagon",
    compoundCondition: {
      conditions: [
        { nodeId: NODE_ID_A, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_A_OPT3] } },
        { nodeId: NODE_ID_B, conditionType: "choice", choiceCondition: { choiceIds: [CHOICE_B_OPT1] } },
      ],
      operator: "AND",
    },
  },
  { id: NODE_ID_G, label: "Node G", shape: "rectangle" },
];

// 初期エッジデータ
const initialEdges: CustomEdge[] = [
  { from: NODE_ID_A, to: NODE_ID_B, label: "選択肢1, 選択肢2, 選択肢3", style: "solid" },
  { from: NODE_ID_B, to: STATE_NODE_1, label: "Node A: 選択肢1, 選択肢2 AND Node B: YES", style: "dotted" },
  { from: STATE_NODE_1, to: NODE_ID_C, label: "", style: "solid" },
  { from: NODE_ID_B, to: STATE_NODE_2, label: "Node A: 選択肢3 AND Node B: YES", style: "dotted" },
  { from: STATE_NODE_2, to: NODE_ID_E, label: "", style: "solid" },
  { from: NODE_ID_B, to: NODE_ID_G, label: "NO", style: "solid" },
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
    displayNodes,
    displayEdges,
    coverageResults,
    coverageMap,
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
    selectedEdgeStateNode,
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

  // ========== イベントハンドラ ==========

  // ノードクリック時のハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    if (isStateNode(nodeId)) return;

    let node = currentDefinition.nodes.find(n => n.id === nodeId);
    if (!node) {
      node = currentDefinition.nodes.find(n => n.label === nodeId);
    }
    if (node && isStateNode(node.id)) return;

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

    if (result.compoundCondition && result.compoundCondition.conditions.length > 0) {
      const stateNodeId = generateStateNodeId(result.compoundCondition.conditions);
      const stateNodeLabel = generateStateNodeLabel(result.compoundCondition.conditions, customNodes);
      const existingStateNode = customNodes.find(n => n.id === stateNodeId);

      if (!existingStateNode) {
        setCustomNodes(prev => [...prev, {
          id: stateNodeId,
          label: stateNodeLabel,
          shape: 'hexagon',
          compoundCondition: result.compoundCondition,
        }]);
      }

      const compoundLabel = generateCompoundConditionEdgeLabel(result.compoundCondition.conditions, customNodes);

      const newEdges: CustomEdge[] = [
        { from: selectedSourceNode.id, to: stateNodeId, label: compoundLabel, style: 'dotted' },
        { from: stateNodeId, to: result.targetNodeId, label: result.label, style: result.style },
      ];

      setCustomEdges(prev => [...prev, ...newEdges]);
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

  // ノード削除のハンドラ（連鎖削除）
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (isStateNode(nodeId)) return;

    const relatedStateNodes = customNodes.filter(node =>
      isStateNode(node.id) &&
      node.compoundCondition?.conditions.some(c => c.nodeId === nodeId)
    );
    const stateNodeIds = relatedStateNodes.map(n => n.id);

    const newEdges = customEdges.filter(edge =>
      edge.from !== nodeId &&
      edge.to !== nodeId &&
      !stateNodeIds.includes(edge.from) &&
      !stateNodeIds.includes(edge.to)
    );

    const newNodes = customNodes.filter(node =>
      node.id !== nodeId && !stateNodeIds.includes(node.id)
    );

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
      return { ...edge, label: update.label, style: update.style, condition: update.condition };
    }));
  }, [selectedEdgeIndex, setCustomEdges]);

  // エッジ削除のハンドラ（ダイアログから）
  const handleDeleteEdge = useCallback(() => {
    if (selectedEdgeIndex === null) return;

    const edgeToDelete = customEdges[selectedEdgeIndex];

    if (edgeToDelete && isStateNode(edgeToDelete.to)) {
      const stateNodeId = edgeToDelete.to;
      setCustomNodes(prev => prev.filter(n => n.id !== stateNodeId));
      setCustomEdges(prev => prev.filter(e => e.from !== stateNodeId && e.to !== stateNodeId));
    } else {
      setCustomEdges(prev => prev.filter((_, index) => index !== selectedEdgeIndex));
    }

    setSelectedEdgeIndex(null);
  }, [selectedEdgeIndex, customEdges, setCustomNodes, setCustomEdges, setSelectedEdgeIndex]);

  // 複合条件更新のハンドラ
  const handleUpdateCompoundCondition = useCallback((update: CompoundConditionUpdateResult) => {
    if (selectedEdgeIndex === null || !selectedEdgeStateNode) return;

    const oldStateNodeId = selectedEdgeStateNode.id;
    const newStateNodeId = generateStateNodeId(update.compoundCondition.conditions);
    const newStateNodeLabel = generateStateNodeLabel(update.compoundCondition.conditions, customNodes);

    setCustomNodes(prev => prev.map(node => {
      if (node.id !== oldStateNodeId) return node;
      return {
        ...node,
        id: newStateNodeId,
        label: newStateNodeLabel,
        compoundCondition: update.compoundCondition,
      };
    }));

    setCustomEdges(prev => prev.map(edge => {
      if (edge.to === oldStateNodeId) {
        return { ...edge, to: newStateNodeId, label: update.label };
      }
      if (edge.from === oldStateNodeId) {
        return { ...edge, from: newStateNodeId };
      }
      return edge;
    }));

    setSelectedEdgeIndex(null);
  }, [selectedEdgeIndex, selectedEdgeStateNode, customNodes, setCustomNodes, setCustomEdges, setSelectedEdgeIndex]);

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
          displayNodes={displayNodes}
          coverageMap={coverageMap}
          editingChoicesIndex={editingChoicesIndex}
          onAddNode={handleAddNode}
          onUpdateNode={handleUpdateNodeDirect}
          onRemoveNode={handleRemoveNode}
          onToggleChoicesEdit={handleToggleChoicesEdit}
          onAddChoice={handleAddChoice}
          onRemoveChoice={handleRemoveChoice}
          onUpdateChoice={handleUpdateChoice}
          edges={customEdges}
          displayEdges={displayEdges}
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
        availableNodes={currentDefinition.nodes.filter(n => !isStateNode(n.id))}
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
      />

      {/* エッジ編集ダイアログ */}
      <EdgeEditDialog
        isOpen={isEdgeDialogOpen}
        onClose={closeEdgeDialog}
        edge={selectedEdge}
        sourceNode={selectedEdgeSourceNode}
        stateNode={selectedEdgeStateNode}
        conditionNodes={selectedEdgeConditionNodes}
        onUpdateEdge={handleUpdateEdge}
        onUpdateCompoundCondition={handleUpdateCompoundCondition}
        onDeleteEdge={handleDeleteEdge}
      />
    </div>
  );
}
