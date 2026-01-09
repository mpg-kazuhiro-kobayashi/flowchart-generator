/**
 * フローチャートのグラフ構造を解析するユーティリティ関数
 */

import { QuestionCategory, ChoiceOption, SingleCondition } from '@/types/flowchart';

// 状態ノードのプレフィックス
const STATE_NODE_PREFIX = '_state_';

/**
 * 状態ノードかどうかを判定
 */
export function isStateNode(nodeId: string): boolean {
  return nodeId.startsWith(STATE_NODE_PREFIX);
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
}

/**
 * 網羅性チェック結果
 */
export interface CoverageResult {
  /** ノードID */
  nodeId: string;
  /** 設問カテゴリ */
  questionCategory: QuestionCategory;
  /** 全選択肢 */
  allChoices: ChoiceOption[];
  /** 使用済み選択肢ID */
  usedChoiceIds: string[];
  /** 未使用選択肢 */
  unusedChoices: ChoiceOption[];
  /** 網羅されているか */
  isCovered: boolean;
  /** 出力エッジがあるか */
  hasOutgoingEdges: boolean;
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

  // SA/MAノードを抽出
  const questionNodes = nodes.filter(
    node => (node.questionCategory === 'SA' || node.questionCategory === 'MA') &&
            node.choices &&
            node.choices.length > 0 &&
            !isStateNode(node.id)
  );

  for (const node of questionNodes) {
    const choices = node.choices!;
    const usedChoiceIds = new Set<string>();

    // このノードから出るエッジを検索
    const outgoingEdges = edges.filter(edge => edge.from === node.id);

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
    const hasOutgoingEdges = outgoingEdges.length > 0;

    results.push({
      nodeId: node.id,
      questionCategory: node.questionCategory!,
      allChoices: choices,
      usedChoiceIds: Array.from(usedChoiceIds),
      unusedChoices,
      isCovered: unusedChoices.length === 0 && hasOutgoingEdges,
      hasOutgoingEdges,
    });
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
