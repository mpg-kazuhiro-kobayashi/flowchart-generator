'use client';

import { useMemo, useCallback } from 'react';
import FlowchartRenderer, { EdgeClickInfo } from '@/components/FlowchartRenderer';
import NodeEditDialog, { AddConditionResult, NodeUpdateResult, CoverageInfo } from '@/components/NodeEditDialog';
import EdgeEditDialog, { EdgeUpdateResult, CompoundConditionUpdateResult } from '@/components/EdgeEditDialog';
import Sidebar from '@/components/Sidebar';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { getReachableQuestionNodes } from '@/lib/graphUtils';
import { generateStateNodeId, generateStateNodeLabel } from '@/lib/compoundConditionUtils';
import { useFlowchartState } from '@/hooks/useFlowchartState';
import { useDialogState } from '@/hooks/useDialogState';
import {
  FlowchartDefinition,
  CustomNode,
  CustomEdge,
  isStateNode,
} from '@/types/flowchart';

// 初期ノードデータ
const initialNodes: CustomNode[] = [
  {
    id: "A",
    label: "Node A",
    shape: "rectangle",
    questionCategory: "MA",
    choices: [
      { id: "A_opt1", label: "選択肢1" },
      { id: "A_opt2", label: "選択肢2" },
      { id: "A_opt3", label: "選択肢3" },
    ],
  },
  {
    id: "B",
    label: "Node B",
    shape: "rectangle",
    questionCategory: "SA",
    choices: [
      { id: "B_opt1", label: "YES" },
      { id: "B_opt2", label: "NO" },
    ],
  },
  { id: "C", label: "Node C", shape: "rectangle" },
  {
    id: "_state_A_A_opt1_A_opt2_B_B_opt1",
    label: "Node A: 選択肢1, 選択肢2 AND Node B: YES",
    shape: "hexagon",
    compoundCondition: {
      conditions: [
        { nodeId: "A", conditionType: "choice", choiceCondition: { choiceIds: ["A_opt1", "A_opt2"] } },
        { nodeId: "B", conditionType: "choice", choiceCondition: { choiceIds: ["B_opt1"] } },
      ],
      operator: "AND",
    },
  },
  { id: "E", label: "Node E", shape: "rectangle" },
  {
    id: "_state_A_A_opt3_B_B_opt1",
    label: "Node A: 選択肢3 AND Node B: YES",
    shape: "hexagon",
    compoundCondition: {
      conditions: [
        { nodeId: "A", conditionType: "choice", choiceCondition: { choiceIds: ["A_opt3"] } },
        { nodeId: "B", conditionType: "choice", choiceCondition: { choiceIds: ["B_opt1"] } },
      ],
      operator: "AND",
    },
  },
  { id: "G", label: "Node G", shape: "rectangle" },
];

// 初期エッジデータ
const initialEdges: CustomEdge[] = [
  { from: "A", to: "B", label: "選択肢1, 選択肢2, 選択肢3", style: "solid" },
  { from: "B", to: "_state_A_A_opt1_A_opt2_B_B_opt1", label: "Node A: 選択肢1, 選択肢2 AND Node B: YES", style: "dotted" },
  { from: "_state_A_A_opt1_A_opt2_B_B_opt1", to: "C", label: "", style: "solid" },
  { from: "B", to: "_state_A_A_opt3_B_B_opt1", label: "Node A: 選択肢3 AND Node B: YES", style: "dotted" },
  { from: "_state_A_A_opt3_B_B_opt1", to: "E", label: "", style: "solid" },
  { from: "B", to: "G", label: "NO", style: "solid" },
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
    updateNodeId: handleUpdateNodeId,
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

      const compoundLabel = result.compoundCondition.conditions.map(cond => {
        if (cond.conditionType === 'choice' && cond.choiceCondition) {
          const node = customNodes.find(n => n.id === cond.nodeId);
          const choiceLabels = cond.choiceCondition.choiceIds.map(choiceId => {
            const choice = node?.choices?.find(ch => ch.id === choiceId);
            return choice?.label || choiceId;
          });
          return `${node?.label || cond.nodeId}: ${choiceLabels.join(', ')}`;
        } else if (cond.conditionType === 'numeric' && cond.numericCondition) {
          const node = customNodes.find(n => n.id === cond.nodeId);
          const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[cond.numericCondition.operator];
          return `${node?.label || cond.nodeId} ${opSymbol} ${cond.numericCondition.value}`;
        }
        return '';
      }).filter(s => s).join(' AND ');

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
          onUpdateNodeId={handleUpdateNodeId}
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
