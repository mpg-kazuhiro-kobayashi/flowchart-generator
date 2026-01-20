/**
 * 設問ノードの網羅性チェックに関するユーティリティ関数
 */

import { QuestionCategory, ChoiceOption, NumericOperator, CompoundCondition, SingleCondition } from '@/types/flowchart';
import { NumericRange, operatorToRange, findNumericGaps, rangesOverlap, rangeContainedIn } from './numericRange';

/**
 * ノードの型定義（最小限の情報）
 */
interface GraphNode {
  id: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

/**
 * エッジの型定義（条件情報を含む）
 */
interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  condition?: {
    choiceIds?: string[];
    numericCondition?: {
      operator: NumericOperator;
      value: number;
    };
  };
  compoundCondition?: CompoundCondition;
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
    node => node.questionCategory && node.questionCategory !== 'FA'
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

      // 複合条件を持つエッジから使用されている選択肢をチェック
      for (const edge of edges) {
        if (!edge.compoundCondition) continue;

        for (const condition of edge.compoundCondition.conditions) {
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

      // 2. 複合条件を持つエッジから数値条件を収集
      for (const edge of edges) {
        if (!edge.compoundCondition) continue;

        for (const condition of edge.compoundCondition.conditions) {
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
 * エッジ競合の種類
 */
export type ConflictType = 'exact' | 'partial' | 'subset';

/**
 * エッジ競合の詳細
 */
export interface EdgeConflict {
  /** 競合タイプ */
  type: ConflictType;
  /** エッジ1の情報 */
  edge1: { to: string; label: string; isCompound: boolean };
  /** エッジ2の情報 */
  edge2: { to: string; label: string; isCompound: boolean };
  /** 競合している条件の説明 */
  description: string;
}

/**
 * ノードごとの競合チェック結果
 */
export interface ConflictResult {
  /** ソースノードID */
  nodeId: string;
  /** 競合しているエッジのペア */
  conflicts: EdgeConflict[];
}

/**
 * 選択肢IDの配列が重複しているかチェック
 */
function choiceIdsOverlap(ids1: string[], ids2: string[]): boolean {
  return ids1.some(id => ids2.includes(id));
}

/**
 * 選択肢IDの配列が完全一致かチェック
 */
function choiceIdsExactMatch(ids1: string[], ids2: string[]): boolean {
  if (ids1.length !== ids2.length) return false;
  const sorted1 = [...ids1].sort();
  const sorted2 = [...ids2].sort();
  return sorted1.every((id, i) => id === sorted2[i]);
}

/**
 * 選択肢IDの配列が包含関係にあるかチェック（ids1 ⊆ ids2）
 */
function choiceIdsContainedIn(ids1: string[], ids2: string[]): boolean {
  return ids1.every(id => ids2.includes(id));
}

/**
 * エッジから正規化された条件情報を抽出
 */
interface NormalizedCondition {
  /** 通常条件（選択肢） */
  choiceIds?: string[];
  /** 通常条件（数値） */
  numericRange?: NumericRange;
  /** 複合条件 */
  compoundCondition?: CompoundCondition;
  /** 複合条件かどうか */
  isCompound: boolean;
}

function extractCondition(edge: GraphEdge): NormalizedCondition | null {
  if (edge.compoundCondition) {
    return {
      compoundCondition: edge.compoundCondition,
      isCompound: true,
    };
  }
  if (edge.condition?.choiceIds && edge.condition.choiceIds.length > 0) {
    return {
      choiceIds: edge.condition.choiceIds,
      isCompound: false,
    };
  }
  if (edge.condition?.numericCondition) {
    return {
      numericRange: operatorToRange(
        edge.condition.numericCondition.operator,
        edge.condition.numericCondition.value
      ),
      isCompound: false,
    };
  }
  return null;
}

/**
 * 複合条件からソースノードに関する条件を抽出
 */
function extractSourceNodeCondition(
  compoundCondition: CompoundCondition,
  sourceNodeId: string
): SingleCondition | undefined {
  return compoundCondition.conditions.find(c => c.nodeId === sourceNodeId);
}

/**
 * 2つの条件を比較して競合をチェック
 */
function compareConditions(
  cond1: NormalizedCondition,
  cond2: NormalizedCondition,
  sourceNodeId: string,
  edge1: GraphEdge,
  edge2: GraphEdge
): EdgeConflict | null {
  // 通常条件 vs 通常条件
  if (!cond1.isCompound && !cond2.isCompound) {
    // 選択肢条件同士
    if (cond1.choiceIds && cond2.choiceIds) {
      if (choiceIdsExactMatch(cond1.choiceIds, cond2.choiceIds)) {
        return {
          type: 'exact',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: false },
          description: `同じ選択肢条件が重複しています`,
        };
      }
      if (choiceIdsOverlap(cond1.choiceIds, cond2.choiceIds)) {
        return {
          type: 'partial',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: false },
          description: `選択肢条件が部分的に重複しています`,
        };
      }
    }
    // 数値条件同士
    if (cond1.numericRange && cond2.numericRange) {
      if (rangesOverlap(cond1.numericRange, cond2.numericRange)) {
        const isExact =
          cond1.numericRange.min === cond2.numericRange.min &&
          cond1.numericRange.max === cond2.numericRange.max &&
          cond1.numericRange.minInclusive === cond2.numericRange.minInclusive &&
          cond1.numericRange.maxInclusive === cond2.numericRange.maxInclusive;
        return {
          type: isExact ? 'exact' : 'partial',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: false },
          description: isExact
            ? `同じ数値条件が重複しています`
            : `数値条件の範囲が重複しています`,
        };
      }
    }
    return null;
  }

  // 通常条件 vs 複合条件
  if (!cond1.isCompound && cond2.isCompound && cond2.compoundCondition) {
    const sourceCondInCompound = extractSourceNodeCondition(cond2.compoundCondition, sourceNodeId);
    if (!sourceCondInCompound) return null;

    // 選択肢条件の比較
    if (cond1.choiceIds && sourceCondInCompound.choiceCondition) {
      const compoundChoiceIds = sourceCondInCompound.choiceCondition.choiceIds;
      if (choiceIdsContainedIn(cond1.choiceIds, compoundChoiceIds)) {
        return {
          type: 'subset',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
          description: `通常条件が複合条件に包含されています`,
        };
      }
      if (choiceIdsOverlap(cond1.choiceIds, compoundChoiceIds)) {
        return {
          type: 'partial',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
          description: `通常条件と複合条件の選択肢が部分的に重複しています`,
        };
      }
    }
    // 数値条件の比較
    if (cond1.numericRange && sourceCondInCompound.numericCondition) {
      const compoundRange = operatorToRange(
        sourceCondInCompound.numericCondition.operator,
        sourceCondInCompound.numericCondition.value
      );
      if (rangeContainedIn(cond1.numericRange, compoundRange)) {
        return {
          type: 'subset',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
          description: `通常条件の数値範囲が複合条件に包含されています`,
        };
      }
      if (rangesOverlap(cond1.numericRange, compoundRange)) {
        return {
          type: 'partial',
          edge1: { to: edge1.to, label: edge1.label || '', isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
          description: `通常条件と複合条件の数値範囲が重複しています`,
        };
      }
    }
    return null;
  }

  // 複合条件 vs 通常条件（逆順）
  if (cond1.isCompound && !cond2.isCompound) {
    const result = compareConditions(cond2, cond1, sourceNodeId, edge2, edge1);
    if (result) {
      // edge1とedge2を入れ替え
      return {
        ...result,
        edge1: result.edge2,
        edge2: result.edge1,
      };
    }
    return null;
  }

  // 複合条件 vs 複合条件
  if (cond1.isCompound && cond2.isCompound && cond1.compoundCondition && cond2.compoundCondition) {
    return compareCompoundConditions(cond1.compoundCondition, cond2.compoundCondition, edge1, edge2);
  }

  return null;
}

/**
 * 2つの複合条件を比較して競合をチェック
 *
 * AND条件の場合、両方の複合条件を同時に満たす入力が存在するかをチェックする。
 * 各ノードについて条件の交差（intersection）を取り、すべてのノードで交差が空でない場合のみ競合。
 */
function compareCompoundConditions(
  compound1: CompoundCondition,
  compound2: CompoundCondition,
  edge1: GraphEdge,
  edge2: GraphEdge
): EdgeConflict | null {
  // 各ノードIDについて条件を比較
  const nodeIds1 = compound1.conditions.map(c => c.nodeId);
  const nodeIds2 = compound2.conditions.map(c => c.nodeId);

  // すべてのノードIDを収集（両方の条件に含まれるノードのみ比較対象）
  const commonNodeIds = nodeIds1.filter(id => nodeIds2.includes(id));
  if (commonNodeIds.length === 0) return null;

  // AND条件の競合判定：
  // 両方の複合条件を同時に満たす入力が存在するかをチェック
  // 各ノードについて、条件の交差（共通部分）が空でないことが必要
  let hasIntersection = true;  // すべてのノードで交差があるか

  // 包含関係のチェック用
  let allConditions1ContainedIn2 = true;
  let allConditions2ContainedIn1 = true;

  for (const nodeId of commonNodeIds) {
    const cond1 = compound1.conditions.find(c => c.nodeId === nodeId);
    const cond2 = compound2.conditions.find(c => c.nodeId === nodeId);
    if (!cond1 || !cond2) continue;

    // 選択肢条件の比較
    if (cond1.choiceCondition && cond2.choiceCondition) {
      const ids1 = cond1.choiceCondition.choiceIds;
      const ids2 = cond2.choiceCondition.choiceIds;

      // 交差（共通の選択肢）があるかチェック
      // AND条件なので、どちらの条件も満たす選択肢が必要
      if (!choiceIdsOverlap(ids1, ids2)) {
        // このノードで交差がない = 両方の条件を同時に満たす入力は存在しない
        hasIntersection = false;
      }

      // 包含関係のチェック
      if (!choiceIdsContainedIn(ids1, ids2)) {
        allConditions1ContainedIn2 = false;
      }
      if (!choiceIdsContainedIn(ids2, ids1)) {
        allConditions2ContainedIn1 = false;
      }
    }

    // 数値条件の比較
    if (cond1.numericCondition && cond2.numericCondition) {
      const range1 = operatorToRange(cond1.numericCondition.operator, cond1.numericCondition.value);
      const range2 = operatorToRange(cond2.numericCondition.operator, cond2.numericCondition.value);

      // 範囲の交差があるかチェック
      if (!rangesOverlap(range1, range2)) {
        hasIntersection = false;
      }

      // 包含関係のチェック
      if (!rangeContainedIn(range1, range2)) {
        allConditions1ContainedIn2 = false;
      }
      if (!rangeContainedIn(range2, range1)) {
        allConditions2ContainedIn1 = false;
      }
    }
  }

  // 交差がない場合は競合なし
  if (!hasIntersection) {
    return null;
  }

  // 完全一致（相互に包含）
  if (allConditions1ContainedIn2 && allConditions2ContainedIn1) {
    return {
      type: 'exact',
      edge1: { to: edge1.to, label: edge1.label || '', isCompound: true },
      edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
      description: `同じ複合条件が重複しています`,
    };
  }

  // 包含関係（一方がもう一方に完全に包含されている）
  if (allConditions1ContainedIn2) {
    return {
      type: 'subset',
      edge1: { to: edge1.to, label: edge1.label || '', isCompound: true },
      edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
      description: `複合条件1が複合条件2に包含されています`,
    };
  }
  if (allConditions2ContainedIn1) {
    return {
      type: 'subset',
      edge1: { to: edge2.to, label: edge2.label || '', isCompound: true },
      edge2: { to: edge1.to, label: edge1.label || '', isCompound: true },
      description: `複合条件2が複合条件1に包含されています`,
    };
  }

  // 部分的重複（交差があるが、どちらも他方を完全に包含していない）
  return {
    type: 'partial',
    edge1: { to: edge1.to, label: edge1.label || '', isCompound: true },
    edge2: { to: edge2.to, label: edge2.label || '', isCompound: true },
    description: `複合条件が部分的に重複しています`,
  };
}

/**
 * エッジ条件の競合をチェック
 *
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 各ノードの競合チェック結果
 */
export function checkEdgeConditionConflicts<T extends GraphNode>(
  _nodes: T[],
  edges: GraphEdge[]
): ConflictResult[] {
  const results: ConflictResult[] = [];

  // 各ノードをソースとするエッジをグループ化
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const existing = edgesBySource.get(edge.from) || [];
    existing.push(edge);
    edgesBySource.set(edge.from, existing);
  }

  // 各ソースノードについて競合をチェック
  for (const [sourceNodeId, outgoingEdges] of edgesBySource) {
    if (outgoingEdges.length < 2) continue;

    const conflicts: EdgeConflict[] = [];

    // エッジのペアを比較
    for (let i = 0; i < outgoingEdges.length; i++) {
      for (let j = i + 1; j < outgoingEdges.length; j++) {
        const edge1 = outgoingEdges[i];
        const edge2 = outgoingEdges[j];

        const cond1 = extractCondition(edge1);
        const cond2 = extractCondition(edge2);

        // 条件がないエッジはスキップ
        if (!cond1 || !cond2) continue;

        const conflict = compareConditions(cond1, cond2, sourceNodeId, edge1, edge2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    if (conflicts.length > 0) {
      results.push({ nodeId: sourceNodeId, conflicts });
    }
  }

  return results;
}
