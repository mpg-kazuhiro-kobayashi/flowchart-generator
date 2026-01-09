# 複合条件の実装

## 概要

複数の設問ノードの回答結果を組み合わせて、特定の条件を満たした場合のみ遷移する「複合条件」機能。

## 実装完了状態

### 型定義 (`src/types/flowchart.ts`)

```typescript
/** 複合条件の単一条件 */
export interface SingleCondition {
  nodeId: string;
  conditionType: 'choice' | 'numeric';
  choiceCondition?: {
    choiceIds: string[];
    matchType?: 'any' | 'all' | 'exact';
  };
  numericCondition?: NumericCondition;
}

/** 複合条件 */
export interface CompoundCondition {
  conditions: SingleCondition[];
  operator: 'AND';
}

/** 状態ノードのプレフィックス */
export const STATE_NODE_PREFIX = '_state_';
```

### AddConditionDialog.tsx

- `useCompoundCondition`: 複合条件モードの切り替え
- `compoundConditions`: Map<string, SingleCondition> で条件を管理
- `conditionNodes` props: 複合条件設定可能なノード一覧（SA/MA/NA）
- 複合条件UI:
  - SA/MA: 選択肢をボタンで選択
  - NA: 演算子と数値を入力
- `AddConditionResult` に `compoundCondition` プロパティを追加

### page.tsx

- `isStateNode()`: 状態ノードかどうかを判定
- `generateStateNodeId()`: 複合条件から状態ノードIDを生成
- `generateStateNodeLabel()`: 複合条件からラベルを生成
- `displayNodes` / `displayEdges`: サイドパネル表示用（状態ノードを除外）
- `conditionNodes`: 条件設定可能なノード一覧
- `handleAddCondition`: 複合条件の場合に状態ノードを自動生成

## 複合条件の動作フロー

```
1. ユーザーがノードをクリック
2. ダイアログで「複合条件を使用」にチェック（条件設定可能なノードが2つ以上ある場合のみ表示）
3. 2つ以上の設問ノードに対して条件を設定
   - SA: 選択肢を1つ選択
   - MA: 選択肢を複数選択
   - NA: 演算子と数値を入力
4. 接続先ノードを選択して「追加」
5. システムが自動で：
   - 状態ノード（_state_xxx）を作成（六角形）
   - 各条件ノード → 状態ノードへのエッジを追加（点線）
   - 状態ノード → 接続先ノードへのエッジを追加
```

## 設問カテゴリごとの複合条件の扱い

### SA（単一選択）
- 選択肢から1つを選ぶ
- 複合条件: 特定の選択肢が選ばれた場合

### MA（複数選択）
- 複数の選択肢を選べる
- 複合条件: 指定した選択肢が含まれる場合

### NA（数値入力）
- 数値を入力
- 複合条件: 「=」「>」「<」「>=」「<=」の比較演算子で条件指定

### FA（自由入力）
- 分岐不可のため、複合条件の対象外

## 状態ノードの仕様

### 命名規則

```
_state_{条件1ノードID}_{条件1値}_{条件2ノードID}_{条件2値}_...
```

例:
- `_state_Q1_opt1_Q2_opt2` = Q1で選択肢1、Q2で選択肢2を選択した状態
- `_state_Q1_opt1_Q3_gt100` = Q1で選択肢1、Q3で100より大きい

### 表示

- 形状: 六角形（hexagon）
- サイドパネルには表示されない
- 同一の複合条件を持つ状態ノードが既に存在する場合は再利用

## 将来の拡張

- OR条件のサポート
- MAの「含まない」「のみ」条件
- FAの正規表現マッチング
