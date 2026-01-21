# マトリクス SA/MA 設問タイプの実装方針

## 概要

設問タイプに「マトリクス SA」と「マトリクス MA」を追加する。マトリクス形式の設問では、行（項目）と列（選択肢）の組み合わせで回答を収集し、特定の行×列の組み合わせに基づいて分岐条件を設定できる。

## 実装状況

> **注意**: SAMT/MAMT の実装は一旦見送りとなりました。以下は実装済みの内容と今後の参考のためのドキュメントです。

- [ ] 型定義の追加（`src/types/flowchart.ts`）
- [ ] サイドバーでのマトリクス行・列の編集 UI（`src/components/Sidebar/NodeList.tsx`）
- [ ] ノード設定ダイアログでの SAMT/MAMT 選択と設定（`src/components/NodeEditDialog.tsx`）
- [ ] エッジ編集ダイアログでのマトリクス条件編集 UI（`src/components/EdgeEditDialog.tsx`）
- [ ] マトリクス条件のラベル生成
- [ ] Mermaid エッジラベルの特殊文字エスケープ対応（`src/lib/flowchartGenerator.ts`）
- [ ] マトリクス条件エッジのクリック検出とダイアログ表示
- [ ] ダークモード対応（テーブル見出しのテキスト色修正）

### 未実装（今後の課題）

- [ ] マトリクス設問の網羅性チェック
- [ ] マトリクス条件を含む複合条件の網羅性チェック
- [ ] マトリクス条件の競合検出

## マトリクス設問の構造

### 例: 商品満足度調査

|        | 満足 | 普通 | 不満 |
|--------|------|------|------|
| 商品A  |  ○  |      |      |
| 商品B  |      |  ○  |      |
| 商品C  |      |      |  ○  |

- **SAMT（マトリクス SA）**: 各行で1つの列を選択
- **MAMT（マトリクス MA）**: 各行で複数の列を選択可能

## データ構造

### QuestionCategory の拡張

```typescript
// src/types/flowchart.ts
export type QuestionCategory =
  | 'SA'      // Single Answer - 単一選択
  | 'MA'      // Multiple Answer - 複数選択
  | 'FA'      // Free Answer - 自由入力（分岐不可）
  | 'NA'      // Numeric Answer - 数値入力
  | 'SAMT'    // Single Answer Matrix Table - マトリクス単一選択
  | 'MAMT';   // Multiple Answer Matrix Table - マトリクス複数選択
```

### マトリクス設問用のデータ構造

```typescript
// src/types/flowchart.ts

/** マトリクス設問の行（項目） */
export interface MatrixRow {
  /** 行ID */
  id: string;
  /** 行ラベル（例: 商品A, 商品B） */
  label: string;
}

/** マトリクス設問の列（選択肢） */
export interface MatrixColumn {
  /** 列ID */
  id: string;
  /** 列ラベル（例: 満足, 普通, 不満） */
  label: string;
}

/** マトリクス条件の行×列の組み合わせ */
export interface MatrixCellCondition {
  /** 対象の行ID */
  rowId: string;
  /** 選択された列ID（複数可） */
  columnIds: string[];
  /** マッチタイプ（MAMTの場合） */
  matchType?: 'any' | 'all' | 'exact';
}

/** マトリクス条件 */
export interface MatrixConditionValue {
  /** 行×列の条件（複数行に対する条件を設定可能） */
  conditions: MatrixCellCondition[];
  /** 複数行の条件をどう結合するか */
  rowOperator?: 'AND' | 'OR';
}

/** FlowchartNode への追加プロパティ */
export interface FlowchartNode {
  // 既存のプロパティ...

  /** マトリクス設問の行（SAMT/MAMT用） */
  matrixRows?: MatrixRow[];
  /** マトリクス設問の列（SAMT/MAMT用） */
  matrixColumns?: MatrixColumn[];
}

/** エッジの分岐条件 */
export interface EdgeCondition {
  /** 選択肢IDによる条件（SA/MA用） */
  choiceIds?: string[];
  /** 数値条件（NA用） */
  numericCondition?: NumericCondition;
  /** マトリクス条件（SAMT/MAMT用） */
  matrixCondition?: MatrixConditionValue;
}
```

## 分岐条件の例

### 例1: 単一の行×列の条件

「商品Aで満足を選んだ場合」に分岐:

```typescript
condition: {
  matrixCondition: {
    conditions: [
      { rowId: 'productA', columnIds: ['satisfied'] }
    ]
  }
}
```

生成されるラベル: `[商品A=満足]`

### 例2: 複数の行×列の条件（AND）

「商品Aで満足」かつ「商品Bで不満」を選んだ場合:

```typescript
condition: {
  matrixCondition: {
    conditions: [
      { rowId: 'productA', columnIds: ['satisfied'] },
      { rowId: 'productB', columnIds: ['unsatisfied'] }
    ],
    rowOperator: 'AND'
  }
}
```

生成されるラベル: `[商品A=満足 AND 商品B=不満]`

### 例3: 複数の行×列の条件（OR）

「商品A または 商品B で満足を選んだ場合」:

```typescript
condition: {
  matrixCondition: {
    conditions: [
      { rowId: 'productA', columnIds: ['satisfied'] },
      { rowId: 'productB', columnIds: ['satisfied'] }
    ],
    rowOperator: 'OR'
  }
}
```

生成されるラベル: `[商品A=満足 OR 商品B=満足]`

### 例4: MAMT での複数列選択

「商品Aで満足と普通の両方を選んだ場合」（MAMT）:

```typescript
condition: {
  matrixCondition: {
    conditions: [
      { rowId: 'productA', columnIds: ['satisfied', 'normal'], matchType: 'all' }
    ]
  }
}
```

生成されるラベル: `[商品A=満足,普通]`

## 実装詳細

### サイドバー: ノード編集

SAMT/MAMT が選択された場合、行・列の編集 UI が表示される:

```
Node 1
設問タイプ: [MAMT（マトリクスMA）▼]  [行列 (2×3)]
各行で複数の列を選択

--- 行列ボタンクリック時に展開 ---

行（項目）              列（選択肢）
├─ [商品A    ] [×]    ├─ [満足  ] [×]
├─ [商品B    ] [×]    ├─ [普通  ] [×]
└─ [+ 追加]           ├─ [不満  ] [×]
                       └─ [+ 追加]
```

実装ファイル: `src/components/Sidebar/NodeList.tsx`

### ノード設定ダイアログ

設問設定タブで SAMT/MAMT が選択可能。接続追加タブでマトリクス条件を設定できる。

実装ファイル: `src/components/NodeEditDialog.tsx`

コンポーネント:
- `SingleMatrixConditionEditor`: 単一条件用のマトリクスセル選択 UI
- `CompoundMatrixConditionEditor`: 複合条件用のマトリクスセル選択 UI

### エッジ編集ダイアログ

マトリクス条件エッジをクリックすると、マトリクステーブル形式の編集 UI が表示される:

```
分岐条件（マトリクス）

行間の条件: [AND（すべて満たす）▼]

       | 列1 | 列2 |
-------|-----|-----|
  行1  | [✓] | [✓] |
  行2  | [✓] | [✓] |

行1: 列1, 列2 AND 行2: 列1, 列2

条件: [行1=列1,列2 AND 行2=列1,列2]
```

実装ファイル: `src/components/EdgeEditDialog.tsx`

コンポーネント: `MatrixConditionEditor`

### ラベル生成

マトリクス条件のラベルは以下の形式で生成される:

```
[{行ラベル}={列ラベル1},{列ラベル2} {rowOperator} {行ラベル}={列ラベル}]
```

実装箇所:
- `src/components/EdgeEditDialog.tsx` の `generateConditionLabel()` と `generateCompoundConditionLabel()`
- `src/components/NodeEditDialog.tsx` の `generateConditionLabel()`

### Mermaid エスケープ対応

マトリクス条件のラベルに含まれる `[` と `]` は Mermaid の構文と競合するため、HTML エンティティにエスケープされる:

```typescript
// src/lib/flowchartGenerator.ts
private static escapeEdgeLabel(text: string): string {
  return text
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;');
}
```

### エッジクリック時のラベル照合

Mermaid がエスケープされたラベルを不正にレンダリングする場合があるため、`handleEdgeClick` でデコード処理を行う:

```typescript
// src/app/page.tsx
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    // Mermaidの不正なレンダリング対応（&[ → [）
    .replace(/&\[/g, '[')
    .replace(/&\]/g, ']');
};
```

## 網羅性チェック（未実装）

### SAMT の網羅性

各行について、すべての列が使用されているかをチェック:

```
行「商品A」の網羅性:
├─ 列「満足」: ✓ 使用済み
├─ 列「普通」: ✗ 未使用
└─ 列「不満」: ✓ 使用済み

⚠️ 商品A の「普通」が未網羅
```

### MAMT の網羅性

各行について、列の組み合わせパターンの網羅性をチェック。
組み合わせ爆発を避けるため、実用的には「各行×各列」の単体使用をチェック。

## 考慮事項

### パフォーマンス

- 行数×列数が多い場合、組み合わせ数が増大
- 網羅性チェックでは、実用的な範囲に限定（各行×各列の単体チェック）

### UI/UX

- 行・列が多い場合のスクロール対応
- 条件設定時のプレビュー表示
- ダークモード対応（テーブル見出しに `text-gray-900` を明示的に指定）

### 既存機能との互換性

- 複合条件（CompoundCondition）との組み合わせ
- 既存の SA/MA との UI の一貫性

## 関連ファイル

- `src/types/flowchart.ts` - 型定義
- `src/components/Sidebar/NodeList.tsx` - サイドバーのノード編集 UI
- `src/components/NodeEditDialog.tsx` - ノード設定ダイアログ
- `src/components/EdgeEditDialog.tsx` - エッジ編集ダイアログ
- `src/lib/flowchartGenerator.ts` - Mermaid コード生成
- `src/app/page.tsx` - メインページ（状態管理、イベントハンドラ）
- `src/lib/hooks/useFlowchartState.ts` - マトリクス行・列の CRUD 操作
