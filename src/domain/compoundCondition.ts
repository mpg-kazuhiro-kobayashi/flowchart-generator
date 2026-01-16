/**
 * 複合条件に関するユーティリティ関数
 */

import { CompoundCondition, SingleCondition, CustomNode } from '@/types/flowchart';

/**
 * 複合条件からラベルを生成
 */
export const generateCompoundConditionLabel = (
  compoundCondition: CompoundCondition,
  nodes: CustomNode[]
): string => {
  const parts = compoundCondition.conditions.map(c => {
    const node = nodes.find(n => n.id === c.nodeId);
    const nodeName = node?.label || c.nodeId;

    if (c.conditionType === 'choice' && c.choiceCondition) {
      const choiceLabels = c.choiceCondition.choiceIds.map(choiceId => {
        const choice = node?.choices?.find(ch => ch.id === choiceId);
        return choice?.label || choiceId;
      });
      return `${nodeName}: ${choiceLabels.join(', ')}`;
    }
    if (c.conditionType === 'numeric' && c.numericCondition) {
      const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[c.numericCondition.operator];
      return `${nodeName} ${opSymbol} ${c.numericCondition.value}`;
    }
    return nodeName;
  });
  return parts.join(' AND ');
};

/**
 * 複合条件からエッジ用のラベルを生成（SingleCondition配列版）
 */
export const generateCompoundConditionEdgeLabel = (
  conditions: SingleCondition[],
  nodes: CustomNode[]
): string => {
  return generateCompoundConditionLabel({ conditions, operator: 'AND' }, nodes);
};
