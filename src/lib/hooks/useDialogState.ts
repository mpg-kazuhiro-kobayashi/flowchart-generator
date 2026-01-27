"use client";

import { useState, useCallback } from "react";
import { FlowchartNode } from "@/types/flowchart";

/**
 * ダイアログ（ノード編集）の状態管理フック
 */
export function useDialogState() {
  // ノード編集ダイアログ用の状態
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<FlowchartNode | null>(null);

  // ========== ノードダイアログ操作 ==========

  const openNodeDialog = useCallback((node: FlowchartNode) => {
    setSelectedSourceNode(node);
    setIsNodeDialogOpen(true);
  }, []);

  const closeNodeDialog = useCallback(() => {
    setIsNodeDialogOpen(false);
    setSelectedSourceNode(null);
  }, []);

  return {
    // Node dialog
    isNodeDialogOpen,
    selectedSourceNode,
    openNodeDialog,
    closeNodeDialog,
  };
}
