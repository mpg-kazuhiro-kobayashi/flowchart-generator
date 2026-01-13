/**
 * 複合条件に関するユーティリティ関数
 */

import { CompoundCondition, SingleCondition, CustomNode, STATE_NODE_PREFIX } from '@/types/flowchart';

/**
 * 複合条件から状態ノードのIDを生成
 */
export const generateStateNodeId = (conditions: SingleCondition[]): string => {
  const parts = conditions.map(c => {
    if (c.conditionType === 'choice' && c.choiceCondition) {
      return `${c.nodeId}_${c.choiceCondition.choiceIds.join('_')}`;
    }
    if (c.conditionType === 'numeric' && c.numericCondition) {
      return `${c.nodeId}_${c.numericCondition.operator}${c.numericCondition.value}`;
    }
    return c.nodeId;
  });
  return `${STATE_NODE_PREFIX}${parts.join('_')}`;
};

/**
 * 複合条件からラベルを生成
 */
export const generateStateNodeLabel = (conditions: SingleCondition[], nodes: CustomNode[]): string => {
  const parts = conditions.map(c => {
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
 * 複合条件からエッジラベルを生成
 * generateStateNodeLabelと同じ出力だが、意図を明確にするため別関数として定義
 */
export const generateCompoundConditionLabel = (
  compoundCondition: CompoundCondition,
  nodes: CustomNode[]
): string => {
  return generateStateNodeLabel(compoundCondition.conditions, nodes);
};

/**
 * 複合条件からエッジ用のラベルを生成（SingleCondition配列版）
 */
export const generateCompoundConditionEdgeLabel = (
  conditions: SingleCondition[],
  nodes: CustomNode[]
): string => {
  return generateStateNodeLabel(conditions, nodes);
};
