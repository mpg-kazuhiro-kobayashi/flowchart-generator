/**
 * 設問ノードの網羅性チェックに関するユーティリティ関数
 */

import {
  QuestionCategory,
  ChoiceOption,
  CompoundCondition,
  SingleCondition,
  FlowchartEdge,
  NodeEntryRule,
} from "@/types/flowchart";
import {
  NumericRange,
  operatorToRange,
  findNumericGaps,
  rangesOverlap,
  rangeContainedIn,
} from "./numericRange";

/**
 * ノードの型定義（最小限の情報）
 */
interface GraphNode {
  id: string;
  label?: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
  entryRules?: NodeEntryRule[];
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
 * 指定したソースノードからのデフォルトエッジが存在するかをチェック
 *
 * @param sourceNodeId ソースノードID
 * @param nodes 全ノードの配列
 * @returns デフォルトエッジが存在する場合は true
 */
function hasDefaultEdgeFromNode<T extends GraphNode>(sourceNodeId: string, nodes: T[]): boolean {
  for (const node of nodes) {
    if (!node.entryRules) continue;
    for (const rule of node.entryRules) {
      if (rule.sourceNodeId === sourceNodeId && rule.visibilityCondition?.type === "default") {
        return true;
      }
    }
  }
  return false;
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
  edges: FlowchartEdge[],
): CoverageResult[] {
  const results: CoverageResult[] = [];

  // SA/MA/NAノードを抽出（FAは分岐不可のため除外）
  const questionNodes = nodes.filter(
    (node) => node.questionCategory && node.questionCategory !== "FA",
  );

  for (const node of questionNodes) {
    const choices = node.choices || [];
    const usedChoiceIds = new Set<string>();

    // このノードから出るエッジを検索
    const outgoingEdges = edges.filter((edge) => edge.from === node.id);

    // デフォルトエッジの存在をチェック
    const hasDefaultEdge = hasDefaultEdgeFromNode(node.id, nodes);
    const hasOutgoingEdges = outgoingEdges.length > 0;

    // SA/MAの場合: 選択肢の網羅性をチェック
    if ((node.questionCategory === "SA" || node.questionCategory === "MA") && choices.length > 0) {
      // このノードから直接出るエッジの条件をチェック
      for (const edge of outgoingEdges) {
        // 1. エッジに直接設定された単一条件をチェック
        if (edge.condition?.choiceIds) {
          for (const choiceId of edge.condition.choiceIds) {
            usedChoiceIds.add(choiceId);
          }
        }

        // 2. エッジの複合条件内で、このノード自身の選択肢が使用されているかチェック
        if (edge.compoundCondition) {
          for (const condition of edge.compoundCondition.conditions) {
            if (condition.nodeId === node.id && condition.choiceCondition) {
              for (const choiceId of condition.choiceCondition.choiceIds) {
                usedChoiceIds.add(choiceId);
              }
            }
          }
        }
      }

      const unusedChoices = choices.filter((c) => !usedChoiceIds.has(c.id));

      // デフォルトエッジがある場合は、未使用選択肢があっても網羅されているとみなす
      const isCovered = hasDefaultEdge
        ? hasOutgoingEdges
        : unusedChoices.length === 0 && hasOutgoingEdges;

      results.push({
        nodeId: node.id,
        questionCategory: node.questionCategory,
        allChoices: choices,
        usedChoiceIds: Array.from(usedChoiceIds),
        unusedChoices,
        isCovered,
        hasOutgoingEdges,
        outgoingEdgeCount: outgoingEdges.length,
      });
    }
    // NAの場合: 数値条件の網羅性をチェック
    else if (node.questionCategory === "NA") {
      const ranges: NumericRange[] = [];

      // このノードから直接出るエッジの数値条件を収集
      for (const edge of outgoingEdges) {
        // 1. 単一条件の数値条件
        if (edge.condition?.numericCondition) {
          const { operator, value } = edge.condition.numericCondition;
          ranges.push(operatorToRange(operator, value));
        }

        // 2. 複合条件内で、このノード自身の数値条件が使用されているかチェック
        if (edge.compoundCondition) {
          for (const condition of edge.compoundCondition.conditions) {
            if (condition.nodeId === node.id && condition.numericCondition) {
              const { operator, value } = condition.numericCondition;
              ranges.push(operatorToRange(operator, value));
            }
          }
        }
      }

      // ギャップを検出
      const numericGaps = findNumericGaps(ranges);

      // デフォルトエッジがある場合は、数値ギャップがあっても網羅されているとみなす
      const isCovered = hasDefaultEdge
        ? hasOutgoingEdges
        : numericGaps.length === 0 && hasOutgoingEdges;

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
type ConflictType = "exact" | "partial" | "subset";

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
interface ConflictResult {
  /** ソースノードID */
  nodeId: string;
  /** 競合しているエッジのペア */
  conflicts: EdgeConflict[];
}

/**
 * 選択肢IDの配列が重複しているかチェック
 */
function choiceIdsOverlap(ids1: string[], ids2: string[]): boolean {
  return ids1.some((id) => ids2.includes(id));
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
  return ids1.every((id) => ids2.includes(id));
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

function extractCondition(edge: FlowchartEdge): NormalizedCondition | null {
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
        edge.condition.numericCondition.value,
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
  sourceNodeId: string,
): SingleCondition | undefined {
  return compoundCondition.conditions.find((c) => c.nodeId === sourceNodeId);
}

/**
 * 2つの条件を比較して競合をチェック
 */
function compareConditions(
  cond1: NormalizedCondition,
  cond2: NormalizedCondition,
  sourceNodeId: string,
  edge1: FlowchartEdge,
  edge2: FlowchartEdge,
): EdgeConflict | null {
  // 通常条件 vs 通常条件
  if (!cond1.isCompound && !cond2.isCompound) {
    // 選択肢条件同士
    if (cond1.choiceIds && cond2.choiceIds) {
      if (choiceIdsExactMatch(cond1.choiceIds, cond2.choiceIds)) {
        return {
          type: "exact",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: false },
          description: `同じ選択肢条件が重複しています`,
        };
      }
      if (choiceIdsOverlap(cond1.choiceIds, cond2.choiceIds)) {
        return {
          type: "partial",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: false },
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
          type: isExact ? "exact" : "partial",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: false },
          description: isExact ? `同じ数値条件が重複しています` : `数値条件の範囲が重複しています`,
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
          type: "subset",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
          description: `通常条件が複合条件に包含されています`,
        };
      }
      if (choiceIdsOverlap(cond1.choiceIds, compoundChoiceIds)) {
        return {
          type: "partial",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
          description: `通常条件と複合条件の選択肢が部分的に重複しています`,
        };
      }
    }
    // 数値条件の比較
    if (cond1.numericRange && sourceCondInCompound.numericCondition) {
      const compoundRange = operatorToRange(
        sourceCondInCompound.numericCondition.operator,
        sourceCondInCompound.numericCondition.value,
      );
      if (rangeContainedIn(cond1.numericRange, compoundRange)) {
        return {
          type: "subset",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
          description: `通常条件の数値範囲が複合条件に包含されています`,
        };
      }
      if (rangesOverlap(cond1.numericRange, compoundRange)) {
        return {
          type: "partial",
          edge1: { to: edge1.to, label: edge1.label || "", isCompound: false },
          edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
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
    return compareCompoundConditions(
      cond1.compoundCondition,
      cond2.compoundCondition,
      edge1,
      edge2,
    );
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
  edge1: FlowchartEdge,
  edge2: FlowchartEdge,
): EdgeConflict | null {
  // 各ノードIDについて条件を比較
  const nodeIds1 = compound1.conditions.map((c) => c.nodeId);
  const nodeIds2 = compound2.conditions.map((c) => c.nodeId);

  // すべてのノードIDを収集（両方の条件に含まれるノードのみ比較対象）
  const commonNodeIds = nodeIds1.filter((id) => nodeIds2.includes(id));
  if (commonNodeIds.length === 0) return null;

  // AND条件の競合判定：
  // 両方の複合条件を同時に満たす入力が存在するかをチェック
  // 各ノードについて、条件の交差（共通部分）が空でないことが必要
  let hasIntersection = true; // すべてのノードで交差があるか

  // 包含関係のチェック用
  let allConditions1ContainedIn2 = true;
  let allConditions2ContainedIn1 = true;

  for (const nodeId of commonNodeIds) {
    const cond1 = compound1.conditions.find((c) => c.nodeId === nodeId);
    const cond2 = compound2.conditions.find((c) => c.nodeId === nodeId);
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
      type: "exact",
      edge1: { to: edge1.to, label: edge1.label || "", isCompound: true },
      edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
      description: `同じ複合条件が重複しています`,
    };
  }

  // 包含関係（一方がもう一方に完全に包含されている）
  if (allConditions1ContainedIn2) {
    return {
      type: "subset",
      edge1: { to: edge1.to, label: edge1.label || "", isCompound: true },
      edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
      description: `複合条件1が複合条件2に包含されています`,
    };
  }
  if (allConditions2ContainedIn1) {
    return {
      type: "subset",
      edge1: { to: edge2.to, label: edge2.label || "", isCompound: true },
      edge2: { to: edge1.to, label: edge1.label || "", isCompound: true },
      description: `複合条件2が複合条件1に包含されています`,
    };
  }

  // 部分的重複（交差があるが、どちらも他方を完全に包含していない）
  return {
    type: "partial",
    edge1: { to: edge1.to, label: edge1.label || "", isCompound: true },
    edge2: { to: edge2.to, label: edge2.label || "", isCompound: true },
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
  edges: FlowchartEdge[],
): ConflictResult[] {
  const results: ConflictResult[] = [];

  // 各ノードをソースとするエッジをグループ化
  const edgesBySource = new Map<string, FlowchartEdge[]>();
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

/**
 * 組み合わせ条件の詳細
 */
interface CombinationCondition {
  nodeId: string;
  nodeLabel: string;
  choiceIds: string[];
  choiceLabel: string;
}

/**
 * 未カバーの組み合わせ
 */
interface UncoveredCombination {
  conditions: CombinationCondition[];
}

/**
 * 複合条件の組み合わせ網羅性チェック結果
 */
export interface CompoundCoverageResult {
  /** ノードID */
  nodeId: string;
  /** 複合条件の組み合わせ網羅性チェックが適用されるか */
  hasCompoundConditions: boolean;
  /** 関連するノードID */
  relatedNodeIds: string[];
  /** 未カバーの組み合わせ */
  uncoveredCombinations: UncoveredCombination[];
  /** 組み合わせが完全に網羅されているか */
  isFullyCovered: boolean;
}

/**
 * 選択肢の組み合わせを表す型（各ノードIDに対して選択されている選択肢IDの集合）
 */
type ChoiceCombination = Map<string, string[]>;

/**
 * 選択肢IDセットをソートして重複排除
 */
function normalizeChoiceSet(choiceIds: string[]): string[] {
  return Array.from(new Set(choiceIds)).sort((a, b) => a.localeCompare(b));
}

/**
 * 選択肢IDセットの比較
 */
function areChoiceSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * 組み合わせの直積を生成
 */
function generateCartesianProduct(nodeChoices: Map<string, string[][]>): ChoiceCombination[] {
  const nodeIds = Array.from(nodeChoices.keys());
  if (nodeIds.length === 0) return [];

  const result: ChoiceCombination[] = [];

  function generate(index: number, current: ChoiceCombination) {
    if (index === nodeIds.length) {
      result.push(new Map(current));
      return;
    }

    const nodeId = nodeIds[index];
    const choices = nodeChoices.get(nodeId) || [];

    for (const choiceSet of choices) {
      current.set(nodeId, [...choiceSet]);
      generate(index + 1, current);
    }
  }

  generate(0, new Map());
  return result;
}

/**
 * 組み合わせを文字列キーに変換（比較用）
 */
function combinationToKey(combination: ChoiceCombination): string {
  const entries = Array.from(combination.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([nodeId, choiceIds]) => `${nodeId}:${choiceIds.join("&")}`).join("|");
}

/**
 * matchType に応じた複数選択肢の組み合わせを関連ノード候補へ追加
 */
function addMatchTypeChoiceSets(
  relatedNodeChoices: Map<string, string[][]>,
  edges: FlowchartEdge[],
): void {
  for (const edge of edges) {
    if (!edge.compoundCondition) continue;
    for (const condition of edge.compoundCondition.conditions) {
      const choiceCondition = condition.choiceCondition;
      if (!choiceCondition) continue;
      const { matchType, choiceIds } = choiceCondition;
      if (!choiceIds || choiceIds.length === 0) continue;
      if (matchType !== "all" && matchType !== "exact") continue;

      const nodeChoices = relatedNodeChoices.get(condition.nodeId);
      if (!nodeChoices) continue;
      const normalized = normalizeChoiceSet(choiceIds);
      if (!nodeChoices.some((existing) => areChoiceSetsEqual(existing, normalized))) {
        nodeChoices.push(normalized);
      }
    }
  }
}

/**
 * エッジの条件がカバーする組み合わせを計算
 *
 * @param edge エッジ
 * @param sourceNodeId エッジの元ノードID
 * @param relatedNodeChoices 関連ノードの選択肢マップ
 * @returns カバーされる組み合わせの配列
 */
function getEdgeCoveredCombinations(
  edge: FlowchartEdge,
  sourceNodeId: string,
  relatedNodeChoices: Map<string, string[][]>,
): ChoiceCombination[] {
  const coveredCombinations: ChoiceCombination[] = [];
  const relatedNodeIds = Array.from(relatedNodeChoices.keys());

  const buildChoiceSets = (
    choiceIds: string[],
    matchType?: "any" | "all" | "exact",
  ): string[][] => {
    if (!choiceIds || choiceIds.length === 0) {
      return [];
    }
    if (matchType === "all" || matchType === "exact") {
      return [normalizeChoiceSet(choiceIds)];
    }
    return choiceIds.map((choiceId) => [choiceId]);
  };

  if (edge.compoundCondition) {
    // 複合条件の場合：各ノードの条件を取得
    const conditionsByNode = new Map<string, string[][]>();

    for (const condition of edge.compoundCondition.conditions) {
      if (condition.choiceCondition) {
        const choiceSets = buildChoiceSets(
          condition.choiceCondition.choiceIds,
          condition.choiceCondition.matchType,
        );
        if (choiceSets.length > 0) {
          conditionsByNode.set(condition.nodeId, choiceSets);
        }
      }
    }

    // 複合条件に含まれないノードはワイルドカード（すべての選択肢）
    for (const nodeId of relatedNodeIds) {
      if (!conditionsByNode.has(nodeId)) {
        conditionsByNode.set(nodeId, relatedNodeChoices.get(nodeId) || []);
      }
    }

    // 条件の直積を生成
    const combinations = generateCartesianProduct(conditionsByNode);
    coveredCombinations.push(...combinations);
  } else {
    // 単一条件の場合：ソースノードの条件のみ、他はワイルドカード
    const conditionsByNode = new Map<string, string[][]>();

    // ソースノードの条件を設定
    // 構造化データ（condition.choiceIds）のみを参照し、ラベルは参照しない
    if (edge.condition?.choiceIds && edge.condition.choiceIds.length > 0) {
      conditionsByNode.set(
        sourceNodeId,
        edge.condition.choiceIds.map((choiceId) => [choiceId]),
      );
    } else {
      // 構造化された条件がない場合はカバーなし扱い
      return [];
    }

    // 他のノードはワイルドカード
    for (const nodeId of relatedNodeIds) {
      if (nodeId !== sourceNodeId) {
        conditionsByNode.set(nodeId, relatedNodeChoices.get(nodeId) || []);
      }
    }

    const combinations = generateCartesianProduct(conditionsByNode);
    coveredCombinations.push(...combinations);
  }

  return coveredCombinations;
}

/**
 * 複合条件の組み合わせ網羅性をチェック
 *
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 各ノードの複合条件組み合わせ網羅性チェック結果
 */
export function checkCompoundConditionCoverage<T extends GraphNode>(
  nodes: T[],
  edges: FlowchartEdge[],
): CompoundCoverageResult[] {
  const results: CompoundCoverageResult[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 各ノードをソースとするエッジをグループ化
  const edgesBySource = new Map<string, FlowchartEdge[]>();
  for (const edge of edges) {
    const existing = edgesBySource.get(edge.from) || [];
    existing.push(edge);
    edgesBySource.set(edge.from, existing);
  }

  // 各設問ノードについてチェック
  for (const node of nodes) {
    // SA/MA ノードのみ対象
    if (
      !node.questionCategory ||
      node.questionCategory === "FA" ||
      node.questionCategory === "NA"
    ) {
      continue;
    }

    const outgoingEdges = edgesBySource.get(node.id) || [];
    if (outgoingEdges.length === 0) continue;

    // 複合条件を持つエッジがあるかチェック
    const compoundConditionEdges = outgoingEdges.filter((e) => e.compoundCondition);
    if (compoundConditionEdges.length === 0) {
      // 複合条件がない場合はスキップ（既存の単一網羅性チェックで対応）
      continue;
    }

    // デフォルトエッジの存在をチェック
    const hasDefaultEdge = hasDefaultEdgeFromNode(node.id, nodes);

    // デフォルトエッジがある場合は、未カバーの組み合わせがあっても網羅されているとみなす
    if (hasDefaultEdge) {
      const relatedNodeIds = new Set<string>();
      relatedNodeIds.add(node.id);
      for (const edge of compoundConditionEdges) {
        if (edge.compoundCondition) {
          for (const condition of edge.compoundCondition.conditions) {
            relatedNodeIds.add(condition.nodeId);
          }
        }
      }

      results.push({
        nodeId: node.id,
        hasCompoundConditions: true,
        relatedNodeIds: Array.from(relatedNodeIds),
        uncoveredCombinations: [],
        isFullyCovered: true,
      });
      continue;
    }

    // 複合条件に関連するノードIDを収集
    const relatedNodeIds = new Set<string>();
    relatedNodeIds.add(node.id); // ソースノード自身

    for (const edge of compoundConditionEdges) {
      if (edge.compoundCondition) {
        for (const condition of edge.compoundCondition.conditions) {
          relatedNodeIds.add(condition.nodeId);
        }
      }
    }

    // 関連ノードの選択肢を収集
    const relatedNodeChoices = new Map<string, string[][]>();
    for (const nodeId of relatedNodeIds) {
      const relatedNode = nodeMap.get(nodeId);
      if (relatedNode?.choices && relatedNode.choices.length > 0) {
        relatedNodeChoices.set(
          nodeId,
          relatedNode.choices.map((c) => [c.id]),
        );
      }
    }

    // 選択肢がないノードがある場合はスキップ
    if (relatedNodeChoices.size !== relatedNodeIds.size) {
      continue;
    }

    // matchType が all/exact の複合条件があれば組み合わせ候補に追加
    addMatchTypeChoiceSets(relatedNodeChoices, compoundConditionEdges);

    // 理論上の全組み合わせを生成
    const allCombinations = generateCartesianProduct(relatedNodeChoices);

    // 各エッジがカバーする組み合わせを計算
    const coveredKeys = new Set<string>();
    for (const edge of outgoingEdges) {
      const coveredCombinations = getEdgeCoveredCombinations(edge, node.id, relatedNodeChoices);
      for (const combination of coveredCombinations) {
        coveredKeys.add(combinationToKey(combination));
      }
    }

    // 未カバーの組み合わせを検出
    const uncoveredCombinations: UncoveredCombination[] = [];
    for (const combination of allCombinations) {
      const key = combinationToKey(combination);
      if (!coveredKeys.has(key)) {
        // 未カバーの組み合わせを詳細情報に変換
        const conditions: CombinationCondition[] = [];
        for (const [nodeId, choiceIds] of combination) {
          const relatedNode = nodeMap.get(nodeId);
          const labels = choiceIds.map((choiceId) => {
            const choice = relatedNode?.choices?.find((c) => c.id === choiceId);
            return choice?.label || choiceId;
          });
          conditions.push({
            nodeId,
            nodeLabel: relatedNode?.label || nodeId,
            choiceIds: [...choiceIds],
            choiceLabel: labels.join(" + "),
          });
        }
        uncoveredCombinations.push({ conditions });
      }
    }

    results.push({
      nodeId: node.id,
      hasCompoundConditions: true,
      relatedNodeIds: Array.from(relatedNodeIds),
      uncoveredCombinations,
      isFullyCovered: uncoveredCombinations.length === 0,
    });
  }

  return results;
}
