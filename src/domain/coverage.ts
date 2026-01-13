/**
 * 設問ノードの網羅性チェックに関するユーティリティ関数
 */

import { QuestionCategory, ChoiceOption, SingleCondition, NumericOperator, isStateNode } from '@/types/flowchart';
import { NumericRange, operatorToRange, findNumericGaps } from './numericRange';

/**
 * ノードの型定義（最小限の情報）
 */
interface GraphNode {
  id: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
  compoundCondition?: {
    conditions: SingleCondition[];
  };
}

/**
 * エッジの型定義（条件情報を含む）
 */
interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  condition?: {
    numericCondition?: {
      operator: NumericOperator;
      value: number;
    };
  };
}

/**
 * 網羅性チェック結果
 */
export interface CoverageResult {
  /** ノードID */
  nodeId: string;
  /** 設問カテゴリ */
  questionCategory: QuestionCategory;
  /** 全選択肢（SA/MA用） */
  allChoices: ChoiceOption[];
  /** 使用済み選択肢ID（SA/MA用） */
  usedChoiceIds: string[];
  /** 未使用選択肢（SA/MA用） */
  unusedChoices: ChoiceOption[];
  /** 網羅されているか */
  isCovered: boolean;
  /** 出力エッジがあるか */
  hasOutgoingEdges: boolean;
  /** 出力エッジの数 */
  outgoingEdgeCount: number;
  /** 数値条件のギャップ（NA用） */
  numericGaps?: NumericRange[];
}

/**
 * 設問ノードの選択肢網羅性をチェック
 *
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 各設問ノードの網羅性チェック結果
 */
export function checkChoiceCoverage<T extends GraphNode>(
  nodes: T[],
  edges: GraphEdge[]
): CoverageResult[] {
  const results: CoverageResult[] = [];

  // SA/MA/NAノードを抽出（FAは分岐不可のため除外）
  const questionNodes = nodes.filter(
    node => node.questionCategory &&
            node.questionCategory !== 'FA' &&
            !isStateNode(node.id)
  );

  for (const node of questionNodes) {
    const choices = node.choices || [];
    const usedChoiceIds = new Set<string>();

    // このノードから出るエッジを検索
    const outgoingEdges = edges.filter(edge => edge.from === node.id);
    const hasOutgoingEdges = outgoingEdges.length > 0;

    // SA/MAの場合: 選択肢の網羅性をチェック
    if ((node.questionCategory === 'SA' || node.questionCategory === 'MA') && choices.length > 0) {
      // エッジのラベルから使用されている選択肢を抽出
      for (const edge of outgoingEdges) {
        if (edge.label) {
          // ラベルに含まれる選択肢を探す
          for (const choice of choices) {
            if (edge.label.includes(choice.label)) {
              usedChoiceIds.add(choice.id);
            }
          }
        }
      }

      // 複合条件（状態ノード）で使用されている選択肢もチェック
      const stateNodes = nodes.filter(n => isStateNode(n.id) && n.compoundCondition);
      for (const stateNode of stateNodes) {
        if (!stateNode.compoundCondition) continue;

        for (const condition of stateNode.compoundCondition.conditions) {
          if (condition.nodeId === node.id && condition.choiceCondition) {
            for (const choiceId of condition.choiceCondition.choiceIds) {
              usedChoiceIds.add(choiceId);
            }
          }
        }
      }

      const unusedChoices = choices.filter(c => !usedChoiceIds.has(c.id));

      results.push({
        nodeId: node.id,
        questionCategory: node.questionCategory,
        allChoices: choices,
        usedChoiceIds: Array.from(usedChoiceIds),
        unusedChoices,
        isCovered: unusedChoices.length === 0 && hasOutgoingEdges,
        hasOutgoingEdges,
        outgoingEdgeCount: outgoingEdges.length,
      });
    }
    // NAの場合: 数値条件の網羅性をチェック
    else if (node.questionCategory === 'NA') {
      const ranges: NumericRange[] = [];

      // 1. 直接のエッジから数値条件を収集
      for (const edge of outgoingEdges) {
        if (edge.condition?.numericCondition) {
          const { operator, value } = edge.condition.numericCondition;
          ranges.push(operatorToRange(operator, value));
        }
      }

      // 2. 複合条件（状態ノード）から数値条件を収集
      const stateNodes = nodes.filter(n => isStateNode(n.id) && n.compoundCondition);
      for (const stateNode of stateNodes) {
        if (!stateNode.compoundCondition) continue;

        for (const condition of stateNode.compoundCondition.conditions) {
          if (condition.nodeId === node.id && condition.numericCondition) {
            const { operator, value } = condition.numericCondition;
            ranges.push(operatorToRange(operator, value));
          }
        }
      }

      // 3. ギャップを検出
      const numericGaps = findNumericGaps(ranges);
      const isCovered = numericGaps.length === 0 && hasOutgoingEdges;

      results.push({
        nodeId: node.id,
        questionCategory: node.questionCategory,
        allChoices: [],
        usedChoiceIds: [],
        unusedChoices: [],
        isCovered,
        hasOutgoingEdges,
        outgoingEdgeCount: outgoingEdges.length,
        numericGaps: numericGaps.length > 0 ? numericGaps : undefined,
      });
    }
  }

  return results;
}
