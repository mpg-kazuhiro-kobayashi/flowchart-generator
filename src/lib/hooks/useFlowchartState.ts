'use client';

import { useState, useCallback, useMemo } from 'react';
import { CustomNode, FlowchartEdge, NodeEntryRule, NodeVisibilityCondition } from '@/types/flowchart';
import { checkChoiceCoverage, CoverageResult, checkEdgeConditionConflicts, EdgeConflict, checkCompoundConditionCoverage, CompoundCoverageResult } from '@/domain/coverage';
import { generateUUID } from '@/lib/uuid';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';

/**
 * フローチャートのノード状態管理フック
 * edges は entryRules から動的に生成する
 */
export function useFlowchartState(initialNodes: CustomNode[]) {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);

  // 選択肢編集中のノードインデックス
  const [editingChoicesIndex, setEditingChoicesIndex] = useState<number | null>(null);

  // ========== エッジの動的生成 ==========

  // entryRules から edges を動的に生成
  // condition / compoundCondition も含めて変換（網羅性チェックで使用）
  const edges = useMemo((): FlowchartEdge[] => {
    return FlowchartGenerator.generateEdgesFromEntryRules(nodes);
  }, [nodes]);

  // ========== 派生データ ==========

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

  // エッジ条件の競合チェック結果
  const conflictResults = useMemo(() => {
    return checkEdgeConditionConflicts(nodes, edges);
  }, [nodes, edges]);

  // ノードIDから競合チェック結果を取得するマップ
  const conflictMap = useMemo(() => {
    const map = new Map<string, EdgeConflict[]>();
    for (const result of conflictResults) {
      map.set(result.nodeId, result.conflicts);
    }
    return map;
  }, [conflictResults]);

  // 複合条件の組み合わせ網羅性チェック結果
  const compoundCoverageResults = useMemo(() => {
    return checkCompoundConditionCoverage(nodes, edges);
  }, [nodes, edges]);

  // ノードIDから複合条件網羅性チェック結果を取得するマップ
  const compoundCoverageMap = useMemo(() => {
    const map = new Map<string, CompoundCoverageResult>();
    for (const result of compoundCoverageResults) {
      map.set(result.nodeId, result);
    }
    return map;
  }, [compoundCoverageResults]);

  // ========== ノード操作 ==========

  const addNode = useCallback(() => {
    const newId = generateUUID();
    const nodeNumber = nodes.length + 1;
    setNodes(prev => [...prev, { id: newId, label: `Node ${nodeNumber}`, shape: 'rectangle', entryRules: [] }]);
  }, [nodes]);

  const updateNode = useCallback((index: number, updates: Partial<CustomNode>) => {
    setNodes(prev => {
      const newNodes = [...prev];
      newNodes[index] = { ...newNodes[index], ...updates };
      return newNodes;
    });
  }, []);

  const removeNode = useCallback((index: number) => {
    const nodeId = nodes[index].id;
    setNodes(prev => {
      // ノードを削除し、他ノードの entryRules から参照を削除
      return prev
        .filter((_, i) => i !== index)
        .map(node => {
          if (!node.entryRules) return node;

          // sourceNodeId が削除対象のノードを参照している entryRules を削除
          const filteredRules = node.entryRules.filter(rule => rule.sourceNodeId !== nodeId);

          // 複合条件内で削除対象のノードを参照している条件を削除
          const cleanedRules = filteredRules.map(rule => {
            if (rule.visibilityCondition?.type === 'compound') {
              const filteredConditions = rule.visibilityCondition.compound.conditions.filter(
                cond => cond.nodeId !== nodeId
              );
              // 条件が空になった場合は always に変更
              if (filteredConditions.length === 0) {
                return {
                  ...rule,
                  visibilityCondition: { type: 'always' } as NodeVisibilityCondition,
                };
              }
              return {
                ...rule,
                visibilityCondition: {
                  type: 'compound',
                  compound: {
                    ...rule.visibilityCondition.compound,
                    conditions: filteredConditions,
                  },
                } as NodeVisibilityCondition,
              };
            }
            return rule;
          });

          return { ...node, entryRules: cleanedRules };
        });
    });
  }, [nodes]);

  const toggleChoicesEdit = useCallback((index: number) => {
    setEditingChoicesIndex(prev => prev === index ? null : index);
  }, []);

  const addChoice = useCallback((nodeIndex: number) => {
    setNodes(prev => {
      const newNodes = [...prev];
      const node = newNodes[nodeIndex];
      const choices = node.choices || [];
      const newChoiceId = generateUUID();
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

  // ========== EntryRule 操作 ==========

  const addEntryRule = useCallback((nodeId: string, rule: Omit<NodeEntryRule, 'id'>) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      const newRule: NodeEntryRule = {
        ...rule,
        id: generateUUID(),
      };
      return {
        ...node,
        entryRules: [...(node.entryRules || []), newRule],
      };
    }));
  }, []);

  const updateEntryRule = useCallback((nodeId: string, ruleId: string, updates: Partial<NodeEntryRule>) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId || !node.entryRules) return node;
      return {
        ...node,
        entryRules: node.entryRules.map(rule =>
          rule.id === ruleId ? { ...rule, ...updates } : rule
        ),
      };
    }));
  }, []);

  const removeEntryRule = useCallback((nodeId: string, ruleId: string) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId || !node.entryRules) return node;
      return {
        ...node,
        entryRules: node.entryRules.filter(rule => rule.id !== ruleId),
      };
    }));
  }, []);

  return {
    // State
    nodes,
    edges, // 動的に生成される
    setNodes,
    editingChoicesIndex,
    // Derived data
    coverageResults,
    coverageMap,
    conflictResults,
    conflictMap,
    compoundCoverageResults,
    compoundCoverageMap,
    // Node actions
    addNode,
    updateNode,
    removeNode,
    toggleChoicesEdit,
    addChoice,
    removeChoice,
    updateChoice,
    // EntryRule actions
    addEntryRule,
    updateEntryRule,
    removeEntryRule,
  };
}
