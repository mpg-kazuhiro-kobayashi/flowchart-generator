'use client';

import { useState, useCallback, useMemo } from 'react';
import { CustomNode, CustomEdge, isStateNode } from '@/types/flowchart';
import { checkChoiceCoverage, CoverageResult } from '@/domain/coverage';

/**
 * フローチャートのノードとエッジの状態管理フック
 */
export function useFlowchartState(initialNodes: CustomNode[], initialEdges: CustomEdge[]) {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<CustomEdge[]>(initialEdges);

  // 選択肢編集中のノードインデックス
  const [editingChoicesIndex, setEditingChoicesIndex] = useState<number | null>(null);

  // ========== 派生データ ==========

  // サイドパネル表示用（状態ノードを除外）
  const displayNodes = useMemo(() => {
    return nodes.filter(node => !isStateNode(node.id));
  }, [nodes]);

  // サイドパネル表示用エッジ（状態ノード関連を除外）
  const displayEdges = useMemo(() => {
    return edges.filter(edge => !isStateNode(edge.from) && !isStateNode(edge.to));
  }, [edges]);

  // 選択肢の網羅性チェック結果
  const coverageResults = useMemo(() => {
    return checkChoiceCoverage(nodes, edges);
  }, [nodes, edges]);

  // ノードIDから網羅性チェック結果を取得するマップ
  const coverageMap = useMemo(() => {
    const map = new Map<string, CoverageResult>();
    for (const result of coverageResults) {
      map.set(result.nodeId, result);
    }
    return map;
  }, [coverageResults]);

  // ========== ノード操作 ==========

  const addNode = useCallback(() => {
    const newId = String.fromCharCode(65 + nodes.length);
    setNodes(prev => [...prev, { id: newId, label: `Node ${newId}`, shape: 'rectangle' }]);
  }, [nodes.length]);

  const updateNode = useCallback((index: number, updates: Partial<CustomNode>) => {
    setNodes(prev => {
      const newNodes = [...prev];
      newNodes[index] = { ...newNodes[index], ...updates };
      return newNodes;
    });
  }, []);

  const removeNode = useCallback((index: number) => {
    const nodeId = nodes[index].id;
    setNodes(prev => prev.filter((_, i) => i !== index));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
  }, [nodes]);

  const updateNodeId = useCallback((index: number, oldId: string, newId: string) => {
    setNodes(prev => {
      const newNodes = [...prev];
      newNodes[index] = { ...newNodes[index], id: newId };
      return newNodes;
    });
    setEdges(prev => prev.map(edge => ({
      ...edge,
      from: edge.from === oldId ? newId : edge.from,
      to: edge.to === oldId ? newId : edge.to,
    })));
  }, []);

  const toggleChoicesEdit = useCallback((index: number) => {
    setEditingChoicesIndex(prev => prev === index ? null : index);
  }, []);

  const addChoice = useCallback((nodeIndex: number) => {
    setNodes(prev => {
      const newNodes = [...prev];
      const node = newNodes[nodeIndex];
      const choices = node.choices || [];
      const newChoiceId = `${node.id}_opt${choices.length + 1}`;
      newNodes[nodeIndex] = {
        ...node,
        choices: [...choices, { id: newChoiceId, label: `選択肢${choices.length + 1}` }],
      };
      return newNodes;
    });
  }, []);

  const removeChoice = useCallback((nodeIndex: number, choiceIndex: number) => {
    setNodes(prev => {
      const newNodes = [...prev];
      newNodes[nodeIndex] = {
        ...newNodes[nodeIndex],
        choices: newNodes[nodeIndex].choices?.filter((_, i) => i !== choiceIndex),
      };
      return newNodes;
    });
  }, []);

  const updateChoice = useCallback((nodeIndex: number, choiceIndex: number, field: 'id' | 'label', value: string) => {
    setNodes(prev => {
      const newNodes = [...prev];
      if (newNodes[nodeIndex].choices) {
        const newChoices = [...newNodes[nodeIndex].choices!];
        newChoices[choiceIndex] = { ...newChoices[choiceIndex], [field]: value };
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], choices: newChoices };
      }
      return newNodes;
    });
  }, []);

  // ========== エッジ操作 ==========

  const addEdge = useCallback(() => {
    if (nodes.length >= 2) {
      setEdges(prev => [...prev, { from: nodes[0].id, to: nodes[1].id, label: '', style: 'solid' }]);
    }
  }, [nodes]);

  const updateEdge = useCallback((index: number, updates: Partial<CustomEdge>) => {
    setEdges(prev => {
      const newEdges = [...prev];
      newEdges[index] = { ...newEdges[index], ...updates };
      return newEdges;
    });
  }, []);

  const removeEdge = useCallback((index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    // State
    nodes,
    edges,
    setNodes,
    setEdges,
    editingChoicesIndex,
    // Derived data
    displayNodes,
    displayEdges,
    coverageResults,
    coverageMap,
    // Node actions
    addNode,
    updateNode,
    removeNode,
    updateNodeId,
    toggleChoicesEdit,
    addChoice,
    removeChoice,
    updateChoice,
    // Edge actions
    addEdge,
    updateEdge,
    removeEdge,
  };
}
