'use client';

import { useState, useCallback } from 'react';
import {
  FlowchartNode,
  CustomNode,
} from '@/types/flowchart';

/**
 * ダイアログ（ノード編集）の状態管理フック
 */
export function useDialogState() {
  // ノード編集ダイアログ用の状態
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<FlowchartNode | null>(null);
  const [reachableConditionNodes, setReachableConditionNodes] = useState<CustomNode[]>([]);

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

  return {
    // Node dialog
    isNodeDialogOpen,
    selectedSourceNode,
    reachableConditionNodes,
    openNodeDialog,
    closeNodeDialog,
  };
}
