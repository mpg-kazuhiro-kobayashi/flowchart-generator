# 複合条件の経路解析実装方針

## 問題点

### 現在の誤った仕様

フローチャート全体でSA/MA/NAが2つ以上存在する場合、どのノードからでも複合条件が選択可能になっている。

```typescript
// 現在の実装 (page.tsx)
const conditionNodes = useMemo(() => {
  return customNodes.filter(node =>
    node.questionCategory &&
    node.questionCategory !== 'FA' &&
    !isStateNode(node.id)
  );
}, [customNodes]);

// NodeEditDialog で表示判定
conditionNodes.length >= 2  // ← これが誤り
```

### 正しい仕様

選択したノードに到達するまでの**経路上に**SA/MA/NAが2つ以上含まれる場合のみ、複合条件が選択可能になるべき。

## なぜ経路解析が必要か

フローチャートの性質上、複合条件が発生するのは以下の場合のみ：

```
例1: 複合条件が必要なケース
    Start
      ↓
    Q1 (SA) ─── 選択肢A ───┐
      ↓                    ↓
    Q2 (MA) ─── 選択肢B ───┤
      ↓                    ↓
    Target ←──────────────┘

→ Target に到達する経路には Q1 と Q2 があるため、複合条件が必要


例2: 複合条件が不要なケース
    Start
      ↓
    Q1 (SA) ─── 選択肢A ─→ End1
      ↓
    Q2 (MA) ─── 選択肢B ─→ End2

→ End1 に到達する経路には Q1 のみ
→ End2 に到達する経路には Q2 のみ
→ どちらも複合条件は不要
```

## 実装方針

### 1. グラフの逆方向探索アルゴリズム

選択したノードから逆方向にエッジを辿り、到達可能な設問ノードを収集する。

#### アルゴリズム: 深さ優先探索（DFS）

```typescript
/**
 * 指定したノードに到達するまでの経路上にある設問ノードを取得
 * @param targetNodeId 対象ノードのID
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 経路上の設問ノード（SA/MA/NA）の配列
 */
function getReachableQuestionNodes(
  targetNodeId: string,
  nodes: CustomNode[],
  edges: Array<{ from: string; to: string; label: string; style: EdgeStyle }>
): CustomNode[] {
  const visited = new Set<string>();
  const questionNodes: CustomNode[] = [];

  // 逆方向エッジマップを構築（to → from の対応）
  const reverseEdges = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!reverseEdges.has(edge.to)) {
      reverseEdges.set(edge.to, []);
    }
    reverseEdges.get(edge.to)!.push(edge.from);
  });

  // DFS（深さ優先探索）で逆方向に辿る
  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // 現在のノードを取得
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 設問ノード（SA/MA/NA）かつ状態ノードでない場合、収集
    if (
      node.questionCategory &&
      node.questionCategory !== 'FA' &&
      !isStateNode(node.id)
    ) {
      questionNodes.push(node);
    }

    // 逆方向エッジを辿る
    const predecessors = reverseEdges.get(nodeId) || [];
    predecessors.forEach(predId => dfs(predId));
  }

  dfs(targetNodeId);

  return questionNodes;
}
```

### 2. NodeEditDialog での表示判定

```typescript
// page.tsx
const handleNodeClick = useCallback((nodeId: string) => {
  const node = currentDefinition.nodes.find(n => n.id === nodeId);
  if (node) {
    // 経路上の設問ノードを取得
    const reachableQuestionNodes = getReachableQuestionNodes(
      nodeId,
      customNodes,
      customEdges
    );

    setSelectedSourceNode(node);
    setReachableConditionNodes(reachableQuestionNodes); // 新しい状態
    setIsDialogOpen(true);
  }
}, [currentDefinition.nodes, customNodes, customEdges]);
```

```typescript
// NodeEditDialog.tsx
interface NodeEditDialogProps {
  // ...
  conditionNodes?: ConditionNode[];  // ← これを経路上のノードに変更
}

// 複合条件の表示判定
{conditionNodes.length >= 2 && (
  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
    {/* 複合条件UI */}
  </div>
)}
```

### 3. 状態ノードの考慮

状態ノード（`_state_` プレフィックス）は、複合条件によって自動生成されるノードなので、経路解析では以下のように扱う：

```typescript
// 状態ノードを経由する場合、その元となった条件ノードを追跡
if (isStateNode(node.id) && node.compoundCondition) {
  // 状態ノードの複合条件から元の設問ノードを取得
  node.compoundCondition.conditions.forEach(cond => {
    const originalNode = nodes.find(n => n.id === cond.nodeId);
    if (originalNode && !visited.has(originalNode.id)) {
      questionNodes.push(originalNode);
    }
  });
}
```

## エッジケースの処理

### ケース1: 循環参照（サイクル）

フローチャートに循環がある場合、無限ループを防ぐため `visited` セットで訪問済みノードを管理。

```
A → B → C → A  (循環)
```

### ケース2: 複数の経路

複数の経路から同じノードに到達する場合、すべての経路上の設問ノードを収集。

```
Q1 → Q2 → Target
 ↓          ↑
 └─→ Q3 ───┘

→ Target への経路: [Q1, Q2] と [Q1, Q3]
→ 到達可能な設問ノード: Q1, Q2, Q3
```

### ケース3: 開始ノードがない

逆方向に辿っても到達できるノードがない場合、そのノード自身が開始ノードの可能性がある。

## 実装タスク

1. [ ] `getReachableQuestionNodes` 関数を実装（page.tsx または utils）
2. [ ] `handleNodeClick` で経路上の設問ノードを取得
3. [ ] `conditionNodes` を経路上のノードに限定
4. [ ] 状態ノードを経由する場合の処理を追加
5. [ ] エッジケース（循環、複数経路）のテスト

## パフォーマンス考慮事項

- ノード数が少ない場合（< 100ノード）: DFSで十分高速
- ノード数が多い場合: メモ化（キャッシュ）を検討
  ```typescript
  const reachableCache = useMemo(() => new Map<string, CustomNode[]>(), [customNodes, customEdges]);
  ```

## テストケース

### テストケース1: 線形フロー

```
Start → Q1(SA) → Q2(MA) → End
```

- `End` をクリック → conditionNodes: [Q1, Q2] → 複合条件表示 ✅
- `Q2` をクリック → conditionNodes: [Q1] → 複合条件非表示 ❌
- `Q1` をクリック → conditionNodes: [] → 複合条件非表示 ❌

### テストケース2: 分岐フロー

```
        ┌→ Q2(MA) →┐
Start → Q1(SA) →    → End
        └→ Q3(NA) →┘
```

- `End` をクリック → conditionNodes: [Q1, Q2, Q3] → 複合条件表示 ✅
- `Q2` をクリック → conditionNodes: [Q1] → 複合条件非表示 ❌

### テストケース3: 独立したフロー

```
Q1(SA) → End1
Q2(MA) → End2
```

- `End1` をクリック → conditionNodes: [Q1] → 複合条件非表示 ❌
- `End2` をクリック → conditionNodes: [Q2] → 複合条件非表示 ❌

### テストケース4: 状態ノードを経由

```
Q1(SA) → _state_Q1_Q2 → End
Q2(MA) →        ↑
```

- `End` をクリック → conditionNodes: [Q1, Q2]（状態ノードから復元） → 複合条件表示 ✅
