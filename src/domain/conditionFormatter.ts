import {
  NodeVisibilityCondition,
  NumericOperator,
  SingleCondition,
  FlowchartNode,
} from '@/types/flowchart';

/** 数値演算子の表示シンボル */
const operatorSymbols: Record<NumericOperator, string> = {
  eq: '=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

/** 選択肢IDからラベルを解決するための型 */
export interface ConditionLabelResolver {
  getChoiceLabels: (nodeId: string, choiceIds: string[]) => string[];
  getNodeLabel?: (nodeId: string) => string | undefined;
}

/**
 * NodeVisibilityCondition を人間が読める文字列に変換
 */
export function formatCondition(
  condition: NodeVisibilityCondition | undefined,
  sourceNodeId: string,
  resolver: ConditionLabelResolver
): string {
  if (!condition) {
    return '';
  }

  switch (condition.type) {
    case 'always':
      return '';

    case 'default':
      return '条件なし';

    case 'choice': {
      const labels = resolver.getChoiceLabels(sourceNodeId, condition.choiceIds);
      return labels.join(', ');
    }

    case 'numeric': {
      const symbol = operatorSymbols[condition.numeric.operator];
      return `${symbol} ${condition.numeric.value}`;
    }

    case 'compound': {
      return formatCompoundCondition(condition.compound.conditions, resolver);
    }
  }
}

/**
 * 複合条件を人間が読める文字列に変換
 */
function formatCompoundCondition(
  conditions: SingleCondition[],
  resolver: ConditionLabelResolver
): string {
  const parts: string[] = [];

  for (const cond of conditions) {
    const nodeLabel = resolver.getNodeLabel?.(cond.nodeId) || cond.nodeId;

    if (cond.choiceCondition) {
      const choiceLabels = resolver.getChoiceLabels(
        cond.nodeId,
        cond.choiceCondition.choiceIds
      );
      parts.push(`${nodeLabel}: ${choiceLabels.join(', ')}`);
    } else if (cond.numericCondition) {
      const symbol = operatorSymbols[cond.numericCondition.operator];
      parts.push(`${nodeLabel}: ${symbol} ${cond.numericCondition.value}`);
    }
  }

  return parts.join(' AND ');
}

/**
 * ノード配列から ConditionLabelResolver を作成
 */
export function createConditionLabelResolver(
  nodes: FlowchartNode[]
): ConditionLabelResolver {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return {
    getChoiceLabels: (nodeId: string, choiceIds: string[]) => {
      const node = nodeMap.get(nodeId);
      if (!node?.choices) return choiceIds;
      return choiceIds
        .map(id => node.choices?.find(c => c.id === id)?.label || id)
        .filter((label): label is string => Boolean(label));
    },
    getNodeLabel: (nodeId: string) => nodeMap.get(nodeId)?.label,
  };
}
