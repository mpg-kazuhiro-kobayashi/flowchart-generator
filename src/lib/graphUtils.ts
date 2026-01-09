/**
 * フローチャートのグラフ構造を解析するユーティリティ関数
 */

import { QuestionCategory } from '@/types/flowchart';

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
  compoundCondition?: {
    conditions: Array<{
      nodeId: string;
    }>;
  };
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
