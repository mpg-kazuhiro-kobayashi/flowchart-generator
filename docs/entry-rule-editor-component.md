# EntryRuleEditor コンポーネント抽出

## 1. 目的

NodeEditDialog 内の到達ルール編集UI（新規追加・編集）を共通コンポーネントとして抽出し、コードの重複を削減する。

## 2. 現状の問題

NodeEditDialog.tsx 内に以下の重複コードが存在する：

- **新規追加用の状態** (93-102行目): `newRuleSourceNodeId`, `newRuleConditionType`, `newRuleSelectedChoiceIds` など10個
- **編集用の状態** (104-113行目): `editRuleSourceNodeId`, `editRuleConditionType`, `editRuleSelectedChoiceIds` など10個
- **新規追加用のUI** (約150行): 到達ルール追加フォーム
- **編集用のUI** (約150行): 到達ルール編集フォーム（ほぼ同一のコード）

## 3. 実装方針

### 3.1 ファイル構成

```
src/components/
├── EntryRuleEditor.tsx    # 新規：到達ルール編集フォーム（共通コンポーネント）
└── NodeEditDialog.tsx     # 既存：EntryRuleEditor を使用
```

### 3.2 EntryRuleEditor コンポーネント

```tsx
interface ConditionNode {
  id: string;
  label: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

interface EntryRuleEditorProps {
  // 編集モード（add: 新規追加, edit: 編集）
  mode: 'add' | 'edit';
  // 編集対象のルール（mode='edit' 時は必須）
  initialRule?: NodeEntryRule;
  // 対象ノードのID（編集対象ノード、選択肢から除外するため）
  targetNodeId: string;
  // 選択可能なノード一覧
  availableNodes: FlowchartNode[];
  // 条件設定に使える設問ノード一覧
  conditionNodes: ConditionNode[];
  // 保存コールバック
  onSave: (rule: Omit<NodeEntryRule, 'id'>) => void;
  // キャンセルコールバック
  onCancel: () => void;
}
```

**責務:**
- 接続元ノード選択
- 条件タイプ選択（無条件、選択肢、数値、複合、デフォルト）
- 条件詳細の入力
- ラベル入力
- バリデーション
- 保存・キャンセルボタン
- mode に応じたスタイル適用（add: 緑系, edit: 黄系）

### 3.3 NodeEditDialog での使用

```tsx
// 到達ルールタブ内

// 編集モード
{editingRuleId && (
  <EntryRuleEditor
    mode="edit"
    initialRule={editingRule}
    targetNodeId={sourceNode.id}
    availableNodes={availableNodes}
    conditionNodes={conditionNodes}
    onSave={(rule) => {
      onUpdateEntryRule(sourceNode.id, editingRuleId, rule);
      setEditingRuleId(null);
    }}
    onCancel={() => setEditingRuleId(null)}
  />
)}

// 新規追加モード
{isAddingRule && (
  <EntryRuleEditor
    mode="add"
    targetNodeId={sourceNode.id}
    availableNodes={availableNodes}
    conditionNodes={conditionNodes}
    onSave={(rule) => {
      onAddEntryRule(sourceNode.id, rule);
      setIsAddingRule(false);
    }}
    onCancel={() => setIsAddingRule(false)}
  />
)}
```

## 4. メリット

| 観点 | 効果 |
|------|------|
| コード重複削減 | 約300行 → 約150行（状態・UI の重複を解消） |
| 保守性向上 | 編集UIの変更が1箇所で済む |
| 再利用性 | 将来的にエッジクリック編集ダイアログでも使用可能 |

## 5. 作業項目

| # | 作業 | 内容 |
|---|------|------|
| 1 | EntryRuleEditor.tsx 作成 | 状態管理とUIを抽出 |
| 2 | NodeEditDialog.tsx 修正 | EntryRuleEditor を使用するようリファクタ |
| 3 | 動作確認 | 新規追加・編集の両方が正常に動作することを確認 |
