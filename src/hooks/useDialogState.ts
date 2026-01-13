'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  FlowchartNode,
  CustomNode,
  CustomEdge,
  isStateNode,
} from '@/types/flowchart';
import { EdgeInfo, SourceNodeInfo, StateNodeInfo } from '@/components/EdgeEditDialog';

/**
 * ダイアログ（ノード編集・エッジ編集）の状態管理フック
 */
export function useDialogState(nodes: CustomNode[], edges: CustomEdge[]) {
  // ノード編集ダイアログ用の状態
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<FlowchartNode | null>(null);
  const [reachableConditionNodes, setReachableConditionNodes] = useState<CustomNode[]>([]);

  // エッジ編集ダイアログ用の状態
  const [isEdgeDialogOpen, setIsEdgeDialogOpen] = useState(false);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);

  // ========== ノードダイアログ操作 ==========

  const openNodeDialog = useCallback((node: FlowchartNode, reachableNodes: CustomNode[]) => {
    setSelectedSourceNode(node);
    setReachableConditionNodes(reachableNodes);
    setIsNodeDialogOpen(true);
  }, []);

  const closeNodeDialog = useCallback(() => {
    setIsNodeDialogOpen(false);
    setSelectedSourceNode(null);
    setReachableConditionNodes([]);
  }, []);

  // ========== エッジダイアログ操作 ==========

  const openEdgeDialog = useCallback((index: number) => {
    setSelectedEdgeIndex(index);
    setIsEdgeDialogOpen(true);
  }, []);

  const closeEdgeDialog = useCallback(() => {
    setIsEdgeDialogOpen(false);
    setSelectedEdgeIndex(null);
  }, []);

  // ========== 派生データ（エッジダイアログ用） ==========

  const selectedEdge = useMemo((): EdgeInfo | null => {
    if (selectedEdgeIndex === null) return null;
    const edge = edges[selectedEdgeIndex];
    if (!edge) return null;
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: edge.style,
      condition: edge.condition,
    };
  }, [selectedEdgeIndex, edges]);

  const selectedEdgeSourceNode = useMemo((): SourceNodeInfo | undefined => {
    if (!selectedEdge) return undefined;
    const node = nodes.find(n => n.id === selectedEdge.from);
    if (!node) return undefined;
    return {
      id: node.id,
      label: node.label,
      questionCategory: node.questionCategory,
      choices: node.choices,
    };
  }, [selectedEdge, nodes]);

  const selectedEdgeStateNode = useMemo((): StateNodeInfo | undefined => {
    if (!selectedEdge) return undefined;
    if (!isStateNode(selectedEdge.to)) return undefined;
    const stateNode = nodes.find(n => n.id === selectedEdge.to);
    if (!stateNode?.compoundCondition) return undefined;
    return {
      id: stateNode.id,
      label: stateNode.label,
      compoundCondition: stateNode.compoundCondition,
    };
  }, [selectedEdge, nodes]);

  const selectedEdgeConditionNodes = useMemo((): SourceNodeInfo[] => {
    if (!selectedEdgeStateNode?.compoundCondition) return [];
    const conditionNodeIds = selectedEdgeStateNode.compoundCondition.conditions.map(c => c.nodeId);
    return nodes
      .filter(n => conditionNodeIds.includes(n.id))
      .map(n => ({
        id: n.id,
        label: n.label,
        questionCategory: n.questionCategory,
        choices: n.choices,
      }));
  }, [selectedEdgeStateNode, nodes]);

  return {
    // Node dialog
    isNodeDialogOpen,
    selectedSourceNode,
    reachableConditionNodes,
    openNodeDialog,
    closeNodeDialog,
    // Edge dialog
    isEdgeDialogOpen,
    selectedEdgeIndex,
    selectedEdge,
    selectedEdgeSourceNode,
    selectedEdgeStateNode,
    selectedEdgeConditionNodes,
    openEdgeDialog,
    closeEdgeDialog,
    setSelectedEdgeIndex,
  };
}
