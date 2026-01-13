/**
 * フローチャートのグラフ構造を解析するユーティリティ関数
 */

import { QuestionCategory, ChoiceOption, SingleCondition, NumericOperator } from '@/types/flowchart';

// 状態ノードのプレフィックス
const STATE_NODE_PREFIX = '_state_';

/**
 * 状態ノードかどうかを判定
 */
export function isStateNode(nodeId: string): boolean {
  return nodeId.startsWith(STATE_NODE_PREFIX);
}

// ============================================================================
// 数値範囲の網羅性チェック（NA用）
// ============================================================================

/**
 * 数値範囲を表す型
 */
export interface NumericRange {
  /** 下限値（nullは負の無限大） */
  min: number | null;
  /** 下限を含むか */
  minInclusive: boolean;
  /** 上限値（nullは正の無限大） */
  max: number | null;
  /** 上限を含むか */
  maxInclusive: boolean;
}

/**
 * 演算子と値から数値範囲に変換
 */
export function operatorToRange(operator: NumericOperator, value: number): NumericRange {
  switch (operator) {
    case 'eq': // x = value
      return { min: value, minInclusive: true, max: value, maxInclusive: true };
    case 'gt': // x > value
      return { min: value, minInclusive: false, max: null, maxInclusive: false };
    case 'gte': // x >= value
      return { min: value, minInclusive: true, max: null, maxInclusive: false };
    case 'lt': // x < value
      return { min: null, minInclusive: false, max: value, maxInclusive: false };
    case 'lte': // x <= value
      return { min: null, minInclusive: false, max: value, maxInclusive: true };
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * 範囲を文字列で表現（デバッグ・表示用）
 */
export function rangeToString(range: NumericRange): string {
  const { min, minInclusive, max, maxInclusive } = range;

  // 点の場合（eq演算子）
  if (min !== null && max !== null && min === max && minInclusive && maxInclusive) {
    return `x = ${min}`;
  }

  // 下限のみ
  if (min !== null && max === null) {
    return minInclusive ? `x >= ${min}` : `x > ${min}`;
  }

  // 上限のみ
  if (min === null && max !== null) {
    return maxInclusive ? `x <= ${max}` : `x < ${max}`;
  }

  // 両方ある場合（区間）
  if (min !== null && max !== null) {
    const left = minInclusive ? `${min} <=` : `${min} <`;
    const right = maxInclusive ? `<= ${max}` : `< ${max}`;
    return `${left} x ${right}`;
  }

  // 全範囲
  return '全範囲';
}

/**
 * 範囲を下限値でソート（nullは最小として扱う）
 */
function sortRangesByMin(ranges: NumericRange[]): NumericRange[] {
  return [...ranges].sort((a, b) => {
    if (a.min === null && b.min === null) return 0;
    if (a.min === null) return -1;
    if (b.min === null) return 1;
    if (a.min !== b.min) return a.min - b.min;
    // 同じ値の場合、inclusiveを優先
    return a.minInclusive ? -1 : 1;
  });
}

/**
 * 2つの範囲が重複または隣接しているかチェック
 */
function rangesOverlapOrAdjacent(a: NumericRange, b: NumericRange): boolean {
  // aの上限とbの下限を比較
  if (a.max === null) return true; // aが無限大まで伸びている
  if (b.min === null) return true; // bが負の無限大から始まっている

  // 数値比較
  if (a.max > b.min) return true; // 明らかに重複
  if (a.max < b.min) return false; // 明らかにギャップ

  // a.max === b.min の場合
  // どちらかが境界を含んでいれば隣接（ギャップなし）
  return a.maxInclusive || b.minInclusive;
}

/**
 * 2つの範囲をマージ
 */
function mergeTwo(a: NumericRange, b: NumericRange): NumericRange {
  // 下限を決定
  let min: number | null;
  let minInclusive: boolean;
  if (a.min === null || b.min === null) {
    min = null;
    minInclusive = false;
  } else if (a.min < b.min) {
    min = a.min;
    minInclusive = a.minInclusive;
  } else if (a.min > b.min) {
    min = b.min;
    minInclusive = b.minInclusive;
  } else {
    min = a.min;
    minInclusive = a.minInclusive || b.minInclusive;
  }

  // 上限を決定
  let max: number | null;
  let maxInclusive: boolean;
  if (a.max === null || b.max === null) {
    max = null;
    maxInclusive = false;
  } else if (a.max > b.max) {
    max = a.max;
    maxInclusive = a.maxInclusive;
  } else if (a.max < b.max) {
    max = b.max;
    maxInclusive = b.maxInclusive;
  } else {
    max = a.max;
    maxInclusive = a.maxInclusive || b.maxInclusive;
  }

  return { min, minInclusive, max, maxInclusive };
}

/**
 * 重複・隣接する範囲をマージ
 */
function mergeOverlappingRanges(sortedRanges: NumericRange[]): NumericRange[] {
  if (sortedRanges.length === 0) return [];

  const merged: NumericRange[] = [sortedRanges[0]];

  for (let i = 1; i < sortedRanges.length; i++) {
    const current = sortedRanges[i];
    const last = merged[merged.length - 1];

    if (rangesOverlapOrAdjacent(last, current)) {
      // マージ
      merged[merged.length - 1] = mergeTwo(last, current);
    } else {
      // 新しい範囲として追加
      merged.push(current);
    }
  }

  return merged;
}

/**
 * マージ後の範囲からギャップを検出
 */
export function findNumericGaps(ranges: NumericRange[]): NumericRange[] {
  if (ranges.length === 0) {
    // 条件がない場合、全範囲がギャップ
    return [{ min: null, minInclusive: false, max: null, maxInclusive: false }];
  }

  const sorted = sortRangesByMin(ranges);
  const merged = mergeOverlappingRanges(sorted);
  const gaps: NumericRange[] = [];

  // 負の無限大から最初の範囲までのギャップ
  const first = merged[0];
  if (first.min !== null) {
    gaps.push({
      min: null,
      minInclusive: false,
      max: first.min,
      maxInclusive: !first.minInclusive,
    });
  }

  // 範囲間のギャップ
  for (let i = 0; i < merged.length - 1; i++) {
    const current = merged[i];
    const next = merged[i + 1];

    // currentの上限とnextの下限の間にギャップがあるか
    if (current.max !== null && next.min !== null) {
      // 既にマージ済みなので、ここにギャップがあるはず
      gaps.push({
        min: current.max,
        minInclusive: !current.maxInclusive,
        max: next.min,
        maxInclusive: !next.minInclusive,
      });
    }
  }

  // 最後の範囲から正の無限大までのギャップ
  const last = merged[merged.length - 1];
  if (last.max !== null) {
    gaps.push({
      min: last.max,
      minInclusive: !last.maxInclusive,
      max: null,
      maxInclusive: false,
    });
  }

  return gaps;
}

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

/**
 * 指定したノードに到達するまでの経路上にある設問ノードを取得
 *
 * @param targetNodeId 対象ノードのID
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 経路上の設問ノード（SA/MA/NA）の配列
 */
export function getReachableQuestionNodes<T extends GraphNode>(
  targetNodeId: string,
  nodes: T[],
  edges: GraphEdge[]
): T[] {
  const visited = new Set<string>();
  const questionNodeIds = new Set<string>();

  // 逆方向エッジマップを構築（to → from の対応）
  const reverseEdges = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!reverseEdges.has(edge.to)) {
      reverseEdges.set(edge.to, []);
    }
    reverseEdges.get(edge.to)!.push(edge.from);
  });

  /**
   * DFS（深さ優先探索）で逆方向に辿る
   */
  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // 現在のノードを取得
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 状態ノードの場合、その複合条件から元の設問ノードを取得
    if (isStateNode(node.id) && node.compoundCondition) {
      node.compoundCondition.conditions.forEach(cond => {
        const originalNode = nodes.find(n => n.id === cond.nodeId);
        if (
          originalNode &&
          originalNode.questionCategory &&
          originalNode.questionCategory !== 'FA' &&
          !isStateNode(originalNode.id)
        ) {
          questionNodeIds.add(originalNode.id);
        }
      });
    }
    // 設問ノード（SA/MA/NA）かつ状態ノードでない場合、収集
    else if (
      node.questionCategory &&
      node.questionCategory !== 'FA' &&
      !isStateNode(node.id)
    ) {
      questionNodeIds.add(node.id);
    }

    // 逆方向エッジを辿る
    const predecessors = reverseEdges.get(nodeId) || [];
    predecessors.forEach(predId => dfs(predId));
  }

  dfs(targetNodeId);

  // IDセットから実際のノードオブジェクトを取得
  return Array.from(questionNodeIds)
    .map(id => nodes.find(n => n.id === id))
    .filter((node): node is T => node !== undefined);
}
