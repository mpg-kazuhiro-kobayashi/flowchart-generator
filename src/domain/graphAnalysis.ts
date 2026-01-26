/**
 * フローチャートのグラフ構造を解析するユーティリティ関数
 */

import {
  QuestionCategory,
  ChoiceOption,
  FlowchartEdge,
  CompoundCondition,
  SingleCondition,
} from '@/types/flowchart';

/**
 * ノードの型定義（最小限の情報）
 */
interface GraphNode {
  id: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

/**
 * エッジの型定義
 */
interface GraphEdge {
  from: string;
  to: string;
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

    // 設問ノード（SA/MA/NA）の場合、収集
    if (node.questionCategory && node.questionCategory !== 'FA') {
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

/**
 * 指定ノードに到達するために必要な選択肢の制約を計算
 *
 * 経路上のエッジ条件を解析し、各設問ノードで到達可能な選択肢を計算する。
 * 複数経路がある場合は、各経路の制約の和集合を取る。
 *
 * @param targetNodeId 対象ノードID
 * @param edges 全エッジ（condition または compoundCondition を持つ）
 * @returns 設問ノードIDから到達可能な選択肢IDのSetへのMap
 *          - Mapにキーが存在しない場合: そのノードには制約がない（すべての選択肢が到達可能）
 *          - Mapにキーが存在する場合: Setに含まれる選択肢のみが到達可能
 */
export function getReachableChoicesConstraints(
  targetNodeId: string,
  edges: FlowchartEdge[]
): Map<string, Set<string>> {
  // 結果を格納するMap（ノードID → 到達可能な選択肢のSet）
  const result = new Map<string, Set<string>>();

  // 逆方向エッジマップを構築（to → edges の対応）
  const reverseEdgeMap = new Map<string, FlowchartEdge[]>();
  edges.forEach(edge => {
    if (!reverseEdgeMap.has(edge.to)) {
      reverseEdgeMap.set(edge.to, []);
    }
    reverseEdgeMap.get(edge.to)!.push(edge);
  });

  // 各経路で収集した制約を格納（ノードID → 選択肢IDの配列の配列）
  // 複数経路がある場合、各経路の制約を別々に保持し、最後に和集合を取る
  const pathConstraints = new Map<string, Set<string>[]>();

  /**
   * 単一条件から選択肢IDを抽出
   */
  function extractChoiceIdsFromSingleCondition(condition: SingleCondition): string[] {
    if (condition.conditionType === 'choice' && condition.choiceCondition) {
      return condition.choiceCondition.choiceIds;
    }
    return [];
  }

  /**
   * 複合条件から設問ノードごとの選択肢制約を抽出
   */
  function extractConstraintsFromCompoundCondition(
    compound: CompoundCondition
  ): Map<string, string[]> {
    const constraints = new Map<string, string[]>();
    for (const cond of compound.conditions) {
      const choiceIds = extractChoiceIdsFromSingleCondition(cond);
      if (choiceIds.length > 0) {
        constraints.set(cond.nodeId, choiceIds);
      }
    }
    return constraints;
  }

  /**
   * エッジから制約を抽出し、pathConstraints に追加
   */
  function addConstraintsFromEdge(edge: FlowchartEdge) {
    // 複合条件がある場合
    if (edge.compoundCondition) {
      const constraints = extractConstraintsFromCompoundCondition(edge.compoundCondition);
      constraints.forEach((choiceIds, nodeId) => {
        if (!pathConstraints.has(nodeId)) {
          pathConstraints.set(nodeId, []);
        }
        pathConstraints.get(nodeId)!.push(new Set(choiceIds));
      });
    }
    // 単一条件（condition）がある場合
    else if (edge.condition?.choiceIds && edge.condition.choiceIds.length > 0) {
      const nodeId = edge.from; // 単一条件は接続元ノード自身の選択肢
      if (!pathConstraints.has(nodeId)) {
        pathConstraints.set(nodeId, []);
      }
      pathConstraints.get(nodeId)!.push(new Set(edge.condition.choiceIds));
    }
    // default や条件なしの場合は制約を追加しない
  }

  /**
   * DFS（深さ優先探索）で逆方向に辿り、経路上の制約を収集
   */
  const visited = new Set<string>();

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // このノードへ入ってくるエッジを取得
    const incomingEdges = reverseEdgeMap.get(nodeId) || [];

    for (const edge of incomingEdges) {
      // エッジから制約を抽出
      addConstraintsFromEdge(edge);

      // 接続元ノードを辿る
      dfs(edge.from);
    }
  }

  // 対象ノードから逆方向に辿る
  dfs(targetNodeId);

  // 各ノードの制約を和集合にまとめる
  pathConstraints.forEach((constraintSets, nodeId) => {
    if (constraintSets.length === 0) return;

    // 複数経路の制約を和集合にする
    const unionSet = new Set<string>();
    constraintSets.forEach(constraintSet => {
      constraintSet.forEach(choiceId => unionSet.add(choiceId));
    });

    result.set(nodeId, unionSet);
  });

  return result;
}
