# 到達ルール追加時の条件タイプ表示不具合の修正

## 問題概要

ノード追加後、到達ルールを新規追加する際に「選択肢条件」や「複合条件」が条件タイプとして表示されない。
一方、既存の到達ルールを編集する際には正しく表示される。

## 再現手順

1. Node 1（SA、選択肢あり）が存在する状態で、新しい Node 2 を追加
2. Node 2 をクリックしてノード設定ダイアログを開く
3. 「到達ルール」タブで「到達ルールを追加」をクリック
4. 「接続元ノード」に Node 1（SA）を選択
5. 「条件タイプ」のドロップダウンを確認

**期待される動作**: 「無条件」「選択肢条件」「複合条件」「デフォルト」が表示される
**実際の動作**: 「無条件」「デフォルト」のみ表示される

## 原因分析

### 問題のあるコードフロー（修正前）

```
1. handleNodeClick (page.tsx)
   ↓
2. getReachableQuestionNodes(node.id, customNodes, customEdges)
   ↓
3. 逆方向にエッジを辿って経路上の設問ノードを取得
   ↓
4. 結果を reachableConditionNodes として保存
   ↓
5. NodeEditDialog に conditionNodes として渡す
   ↓
6. EntryRuleEditor に conditionNodes として渡す
   ↓
7. conditionNodes を元に条件タイプの選択肢を表示
```

### 根本原因

`getReachableQuestionNodes` 関数は「対象ノードに到達可能な経路上の設問ノード」を返す設計になっている。

```typescript
// graphAnalysis.ts
export function getReachableQuestionNodes(targetNodeId, nodes, edges) {
  // 逆方向にエッジを辿って経路上の設問ノードを取得
  // → 新規ノードにはエッジがないため、空配列が返る
}
```

新規追加したノードにはまだエッジ（entryRules）が設定されていないため、逆方向に辿るノードが存在せず、`conditionNodes` が空になる。

## 採用した修正方針

### 方針: sourceNodeId 選択時に動的に conditionNodes を計算

`conditionNodes` を静的に渡すのではなく、EntryRuleEditor 内で `sourceNodeId`（接続元ノード）が選択されるたびに動的に計算する。

**理由**:
- 接続元ノードから逆方向に辿れる設問ノード + 接続元ノード自身を複合条件に使用できる
- Node 1 (SA) → Node 2 (MA) の経路がある場合、Node 3 への到達ルールで Node 2 を接続元に選択すると、Node 1 と Node 2 の両方を複合条件に使用可能

### 修正内容

#### 1. EntryRuleEditor.tsx の props 変更

```typescript
// 変更前
export interface EntryRuleEditorProps {
  // ...
  conditionNodes: ConditionNode[];
  // ...
}

// 変更後
export interface EntryRuleEditorProps {
  // ...
  /** 全ノード一覧（経路解析用） */
  allNodes: FlowchartNode[];
  /** 全エッジ一覧（経路解析用） */
  allEdges: FlowchartEdge[];
  // ...
}
```

#### 2. EntryRuleEditor.tsx での動的計算

```typescript
// sourceNodeId が変更されるたびに conditionNodes を再計算
const conditionNodes = useMemo((): ConditionNode[] => {
  if (!sourceNodeId) return [];

  // 接続元ノードから逆方向に辿れる設問ノードを取得
  const reachableNodes = getReachableQuestionNodes(sourceNodeId, allNodes, allEdges);

  // 接続元ノード自身が設問ノードの場合は追加
  const sourceNode = allNodes.find(n => n.id === sourceNodeId);
  if (sourceNode && sourceNode.questionCategory && sourceNode.questionCategory !== 'FA') {
    const alreadyIncluded = reachableNodes.some(n => n.id === sourceNodeId);
    if (!alreadyIncluded) {
      reachableNodes.push(sourceNode);
    }
  }

  return reachableNodes.map(node => ({
    id: node.id,
    label: node.label,
    questionCategory: node.questionCategory,
    choices: node.choices,
  }));
}, [sourceNodeId, allNodes, allEdges]);
```

#### 3. 選択肢条件・数値条件の判定は availableNodes から

```typescript
// 接続元ノードの情報は availableNodes から取得（選択肢・数値条件の判定用）
const selectedSourceNode = availableNodes.find(n => n.id === sourceNodeId);
const sourceHasChoices = selectedSourceNode?.choices && selectedSourceNode.choices.length > 0;
const sourceIsNumeric = selectedSourceNode?.questionCategory === 'NA';
```

#### 4. 複合条件の表示条件

```typescript
// 複合条件は経路上に2つ以上の設問ノードがある場合のみ表示
{conditionNodes.length >= 2 && <option value="compound">複合条件</option>}
```

### 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/components/EntryRuleEditor.tsx` | `conditionNodes` props を削除し、`allNodes`/`allEdges` を追加。`sourceNodeId` 選択時に動的に計算 |
| `src/components/NodeEditDialog.tsx` | `conditionNodes` props を削除し、`allNodes`/`allEdges` を追加 |
| `src/components/EntryRuleEditDialog.tsx` | `conditionNodes` props を削除し、`allNodes`/`allEdges` を追加 |
| `src/app/page.tsx` | `conditionNodes` の代わりに `customNodes`/`customEdges` を渡すように変更 |
| `src/lib/hooks/useDialogState.ts` | `reachableConditionNodes` 状態を削除 |

## 動作確認

### テストケース1: 新規ノードへの到達ルール追加（選択肢条件）

1. Node 1（SA、選択肢あり）が存在
2. Node 2 を新規追加
3. Node 2 をクリック → 到達ルール追加
4. 接続元: Node 1 を選択
5. 条件タイプ: 「選択肢条件」が表示されること ✓
6. 選択肢を選択して保存

### テストケース2: 新規ノードへの到達ルール追加（数値条件）

1. Node 1（NA）が存在
2. Node 2 を新規追加
3. Node 2 をクリック → 到達ルール追加
4. 接続元: Node 1 を選択
5. 条件タイプ: 「数値条件」が表示されること ✓
6. 演算子と値を入力して保存

### テストケース3: 新規ノードへの到達ルール追加（複合条件）

1. Node 1（SA）→ Node 2（MA）の経路が存在
2. Node 3 を新規追加
3. Node 3 をクリック → 到達ルール追加
4. 接続元: Node 2 を選択
5. 条件タイプ: 「複合条件」が表示されること ✓（Node 1 と Node 2 を条件に使用可能）

### テストケース4: 既存ルールの編集（複合条件）

1. Node 1（SA）→ Node 2（SA）→ Node 3 の経路が存在
2. Node 3 をクリック → 既存の到達ルールを編集
3. 条件タイプ: 「複合条件」が表示されること ✓
4. 複合条件を設定して保存

### テストケース5: 設問なしノードからの接続

1. Node 1（設問なし）が存在
2. Node 2 を新規追加
3. Node 2 をクリック → 到達ルール追加
4. 接続元: Node 1 を選択
5. 条件タイプ: 「無条件」「デフォルト」のみ表示されること ✓

## 備考

### props の役割の明確化

修正後の役割分担:

| props | 役割 |
|-------|------|
| `availableNodes` | 接続元として選択可能なすべてのノード。接続元ノードの選択肢・数値条件の判定に使用 |
| `allNodes` | 全ノード一覧。経路解析に使用 |
| `allEdges` | 全エッジ一覧。経路解析に使用 |
| `conditionNodes`（内部計算） | 接続元ノードから逆方向に辿れる設問ノード + 接続元自身。複合条件の設定に使用 |
