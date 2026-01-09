# 複合条件の経路解析実装方針

## 問題点

### 問題1: 経路解析の誤り（✅ 修正済み）

**誤った仕様**: フローチャート全体でSA/MA/NAが2つ以上存在する場合、どのノードからでも複合条件が選択可能になっている。

**正しい仕様**: 選択したノードに到達するまでの**経路上に**SA/MA/NAが2つ以上含まれる場合のみ、複合条件が選択可能になるべき。

**修正内容**: `getReachableQuestionNodes` 関数を実装し、DFSで逆方向にエッジを辿って経路上の設問ノードを取得。

---

### 問題2: 複合条件のエッジ生成の誤り（✅ 修正済み）

**修正前の誤った実装**:

```typescript
// page.tsx の handleAddCondition
for (const cond of result.compoundCondition.conditions) {
  // すべての条件ノードから状態ノードへのエッジを作成（誤り）
  newEdges.push({
    from: cond.nodeId,  // ← Q1, Q2 の両方からエッジが作られる
    to: stateNodeId,
    label: edgeLabel,
    style: 'dotted',
  });
}
```

**問題の具体例**:

```
データ構造:
- Q1(MA): choice_1_1, choice_1_2, choice_1_3
- Q2(MA): choice_2_1, choice_2_2, choice_2_3
- Q1 -- choice_1_1, choice_1_2 --> Q2

Q2から複合条件（Q1のchoice_1_1 AND Q2のchoice_2_1）でQ3に接続すると:

誤った結果:
  Q1 ---> _state_Q1_choice_1_1_Q2_choice_2_1
  Q2 ---> _state_Q1_choice_1_1_Q2_choice_2_1
  _state_ ---> Q3

これは「Q1から直接状態ノードに行ける」という誤った経路を作る。
```

**なぜ問題なのか**:

実際のフローは：
1. Q1でchoice_1_1またはchoice_1_2を選択
2. Q2に到達
3. Q2でchoice_2_1を選択
4. **この時点で初めて複合条件が満たされる**

しかし `Q1 --> 状態ノード` のエッジがあると、Q1から直接状態ノードに遷移できてしまう（誤り）。

**正しい設計**:

複合条件は「**最後の設問ノード**（ダイアログを開いたノード）から状態ノードへのエッジ」のみを作るべき。

```
正しいエッジ構造:
Q1 -- choice_1_1, choice_1_2 --> Q2
Q2 -- (choice_2_1 & 複合条件チェック) --> _state_ --> Q3
                                         ↑
                                    ここだけ
```

つまり：
- **選択したノード（Q2）から状態ノードへのエッジのみ**
- 状態ノードから接続先（Q3）へのエッジ

---

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

---

## 実装方針

### 1. グラフの逆方向探索アルゴリズム（✅ 実装済み）

選択したノードから逆方向にエッジを辿り、到達可能な設問ノードを収集する。

#### 実装場所: `src/lib/graphUtils.ts`

```typescript
/**
 * 指定したノードに到達するまでの経路上にある設問ノードを取得
 * @param targetNodeId 対象ノードのID
 * @param nodes 全ノードの配列
 * @param edges 全エッジの配列
 * @returns 経路上の設問ノード（SA/MA/NA）の配列
 */
export function getReachableQuestionNodes<T extends GraphNode>(
  targetNodeId: string,
  nodes: T[],
  edges: GraphEdge[]
): T[]
```

### 2. 複合条件のエッジ生成ロジックの修正（✅ 修正済み）

#### 修正箇所: `page.tsx` の `handleAddCondition`

**修正前の誤った実装**:
```typescript
// すべての条件ノードから状態ノードへエッジを作成（誤り）
for (const cond of result.compoundCondition.conditions) {
  const edgeExists = customEdges.some(e => e.from === cond.nodeId && e.to === stateNodeId);
  if (!edgeExists) {
    // ...
    newEdges.push({
      from: cond.nodeId,  // ← これが誤り
      to: stateNodeId,
      label: edgeLabel,
      style: 'dotted',
    });
  }
}
```

**修正後の正しい実装**:
```typescript
// 複合条件のラベルを生成（すべての条件を含む）
const compoundLabel = result.compoundCondition.conditions.map(cond => {
  if (cond.conditionType === 'choice' && cond.choiceCondition) {
    const node = customNodes.find(n => n.id === cond.nodeId);
    const choiceLabels = cond.choiceCondition.choiceIds.map(choiceId => {
      const choice = node?.choices?.find(ch => ch.id === choiceId);
      return choice?.label || choiceId;
    });
    return `${node?.label || cond.nodeId}: ${choiceLabels.join(', ')}`;
  } else if (cond.conditionType === 'numeric' && cond.numericCondition) {
    const node = customNodes.find(n => n.id === cond.nodeId);
    const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[cond.numericCondition.operator];
    return `${node?.label || cond.nodeId} ${opSymbol} ${cond.numericCondition.value}`;
  }
  return '';
}).filter(s => s).join(' AND ');

// 選択したノード（最後の設問ノード）から状態ノードへのエッジのみ作成
const newEdges: Array<{ from: string; to: string; label: string; style: EdgeStyle }> = [
  // 選択したノードから状態ノードへ（1本のエッジのみ）
  {
    from: selectedSourceNode.id,
    to: stateNodeId,
    label: compoundLabel,
    style: 'dotted',
  },
  // 状態ノードから接続先へ
  {
    from: stateNodeId,
    to: result.targetNodeId,
    label: result.label,
    style: result.style,
  },
];

setCustomEdges(prev => [...prev, ...newEdges]);
```

**修正の要点**:
- すべての条件ノードからエッジを作る代わりに、**選択したノード（`selectedSourceNode`）から状態ノードへのエッジのみ**を作成
- エッジのラベルにすべての複合条件を含める（例: "Q1: choice_1_1 AND Q2: choice_2_1"）
- これにより、複合条件は最後の設問ノードでのみ評価される

### 3. 状態ノードの考慮（✅ 実装済み）

状態ノード（`_state_` プレフィックス）は、複合条件によって自動生成されるノードなので、経路解析では以下のように扱う：

```typescript
// graphUtils.ts
if (isStateNode(node.id) && node.compoundCondition) {
  // 状態ノードの複合条件から元の設問ノードを取得
  node.compoundCondition.conditions.forEach(cond => {
    const originalNode = nodes.find(n => n.id === cond.nodeId);
    if (originalNode && ...) {
      questionNodeIds.add(originalNode.id);
    }
  });
}
```

---

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

---

## 実装タスク

1. [x] `getReachableQuestionNodes` 関数を実装（graphUtils.ts）
2. [x] `handleNodeClick` で経路上の設問ノードを取得
3. [x] `conditionNodes` を経路上のノードに限定
4. [x] 状態ノードを経由する場合の処理を追加
5. [x] **複合条件のエッジ生成ロジックを修正（完了）**
6. [ ] エッジケース（循環、複数経路）のテスト

---

## パフォーマンス考慮事項

- ノード数が少ない場合（< 100ノード）: DFSで十分高速
- ノード数が多い場合: メモ化（キャッシュ）を検討
  ```typescript
  const reachableCache = useMemo(() => new Map<string, CustomNode[]>(), [customNodes, customEdges]);
  ```

---

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

### テストケース5: 複合条件のエッジ生成（修正後）

```
データ構造:
- Q1(MA): choice_1_1, choice_1_2
- Q2(MA): choice_2_1, choice_2_2
- Q1 -- choice_1_1, choice_1_2 --> Q2

Q2から複合条件（Q1のchoice_1_1 AND Q2のchoice_2_1）でQ3に接続:

正しい結果:
  Q1 -- choice_1_1, choice_1_2 --> Q2
  Q2 -- "Q1: choice_1_1 AND Q2: choice_2_1" --> _state_
  _state_ --> Q3

誤った結果（修正前）:
  Q1 --> _state_  ← これは作られるべきではない
  Q2 --> _state_
  _state_ --> Q3
```
