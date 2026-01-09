# ノード削除機能

## 概要

ノード編集ダイアログからノードを削除する機能。関連するエッジと状態ノードを自動で連鎖削除し、データ整合性を保つ。

## 実装状況: ✅ 完了

## 機能仕様

### 削除時の動作

1. ユーザーがフローチャートのノードをクリック
2. ノード設定ダイアログの「設問設定」タブを開く
3. 最下部の「このノードを削除」ボタンをクリック
4. 確認ダイアログで「OK」を選択
5. 以下が自動削除される:
   - 対象ノード
   - 対象ノードを参照するエッジ（from/to）
   - 対象ノードを条件に含む状態ノード
   - 状態ノードを参照するエッジ

### 削除不可のケース

- **状態ノード（`_state_` プレフィックス）**: 直接削除不可。元の設問ノードを削除することで間接的に削除される

## 実装詳細

### NodeEditDialog.tsx

```typescript
interface NodeEditDialogProps {
  // ...
  onDeleteNode?: (nodeId: string) => void;
}
```

- 設問設定タブの最下部に赤い削除ボタンを配置
- 削除前に `confirm()` で確認ダイアログを表示

### page.tsx

```typescript
const handleDeleteNode = useCallback((nodeId: string) => {
  // 状態ノードは直接削除不可
  if (isStateNode(nodeId)) {
    return;
  }

  // 1. 削除するノードを参照している状態ノードを特定
  const relatedStateNodes = customNodes.filter(node =>
    isStateNode(node.id) &&
    node.compoundCondition?.conditions.some(c => c.nodeId === nodeId)
  );
  const stateNodeIds = relatedStateNodes.map(n => n.id);

  // 2. 関連するエッジを削除（ノード自身 + 状態ノード）
  const newEdges = customEdges.filter(edge =>
    edge.from !== nodeId &&
    edge.to !== nodeId &&
    !stateNodeIds.includes(edge.from) &&
    !stateNodeIds.includes(edge.to)
  );

  // 3. ノードを削除（対象ノード + 関連状態ノード）
  const newNodes = customNodes.filter(node =>
    node.id !== nodeId && !stateNodeIds.includes(node.id)
  );

  setCustomNodes(newNodes);
  setCustomEdges(newEdges);
}, [customNodes, customEdges]);
```

## UI

```
┌─────────────────────────────────────┐
│ ノード設定                           │
│ 「ノードA」(A)                       │
├─────────────────────────────────────┤
│ [設問設定] [接続追加]                │
├─────────────────────────────────────┤
│                                     │
│ ノードラベル: [_______________]     │
│                                     │
│ 設問タイプ:                         │
│ ○ 設問なし                          │
│ ○ SA（単一選択）                    │
│ ...                                 │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ [🗑️ このノードを削除]  ← 赤色ボタン │
│                                     │
├─────────────────────────────────────┤
│        [閉じる]  [設定を保存]        │
└─────────────────────────────────────┘
```

## 削除の具体例

### 例1: 単純なノード削除

```
削除前:
A → B → C

B を削除:

削除後:
A    C
```

- ノード B が削除される
- エッジ A → B と B → C が削除される

### 例2: 複合条件を持つノードの削除

```
削除前:
Q1(SA) → Q2(MA) → _state_Q1_opt1_Q2_opt2 → End
                        ↑
              (Q1 と Q2 の複合条件)

Q1 を削除:

削除後:
Q2(MA)    End
```

- ノード Q1 が削除される
- Q1 を含む状態ノード `_state_Q1_opt1_Q2_opt2` が削除される
- 関連するすべてのエッジが削除される

## 将来の拡張（オプション）

- [ ] 削除完了時のトースト通知
- [ ] 削除前に影響範囲の詳細表示
- [ ] 削除の取り消し（Undo）機能
