# 実装方針ドキュメント

このディレクトリには、フローチャートエディタの各機能の実装方針を記載したドキュメントが含まれています。

## 現在の実装状況サマリー

| カテゴリ | 完了 | 未実装 |
|---------|------|--------|
| データモデル | 3 | 0 |
| 網羅性チェック | 4 | 0 |
| UI/UX | 3 | 0 |
| リファクタリング | 3 | 0 |
| 将来機能 | 0 | 1 |

---

## ドキュメント一覧

### データモデル

| ドキュメント | 状況 | 概要 |
|-------------|------|------|
| [node-embedded-conditions.md](./node-embedded-conditions.md) | ✅ 完了 | ノード内条件ベース構造（entryRules）への移行 |
| [compound-condition.md](./compound-condition.md) | ✅ 完了 | 複合条件（AND条件）の実装 |
| [compound-condition-refactoring.md](./compound-condition-refactoring.md) | ✅ 完了 | 状態ノード廃止、エッジに複合条件を直接持たせる構造 |

### 網羅性チェック・競合検出

| ドキュメント | 状況 | 概要 |
|-------------|------|------|
| [na-coverage-check.md](./na-coverage-check.md) | ✅ 完了 | 数値条件（NA）の網羅性チェック・ギャップ検出 |
| [compound-condition-coverage.md](./compound-condition-coverage.md) | ✅ 完了 | 複合条件の組み合わせ網羅性チェック |
| [edge-condition-conflict.md](./edge-condition-conflict.md) | ✅ 完了 | エッジ条件の競合検出（exact/partial/subset） |
| [remove-label-based-coverage.md](./remove-label-based-coverage.md) | ✅ 完了 | ラベル非依存の網羅性チェック |
| [default-edge.md](./default-edge.md) | ✅ 完了 | デフォルトエッジ（フォールバック分岐） |

### UI/UX

| ドキュメント | 状況 | 概要 |
|-------------|------|------|
| [auto-edge-label.md](./auto-edge-label.md) | ✅ 完了 | エッジラベルの自動生成（visibilityCondition から） |
| [entry-rule-editor-component.md](./entry-rule-editor-component.md) | ✅ 完了 | EntryRuleEditor コンポーネント抽出 |
| [node-deletion.md](./node-deletion.md) | ✅ 完了 | ノード削除機能（連鎖削除対応） |
| [compound-condition-path-analysis.md](./compound-condition-path-analysis.md) | ✅ 完了 | 経路解析（到達可能ノードの取得） |

### リファクタリング

| ドキュメント | 状況 | 概要 |
|-------------|------|------|
| [refactoring-plan.md](./refactoring-plan.md) | ✅ 完了 | page.tsx の分割、カスタムフック抽出 |
| [refactoring-phase2.md](./refactoring-phase2.md) | ✅ 完了 | domain/ 配下へのビジネスロジック分離 |

### 将来機能

| ドキュメント | 状況 | 概要 |
|-------------|------|------|
| [matrix-question-type.md](./matrix-question-type.md) | 🚫 見送り | マトリクス設問（SAMT/MAMT） |

---

## 現在のアーキテクチャ

### ディレクトリ構成

```
src/
├── app/
│   └── page.tsx              # メインページ（UIレイアウト）
├── components/               # UIコンポーネント
│   ├── FlowchartRenderer.tsx   # Mermaid SVG 描画
│   ├── NodeEditDialog.tsx      # ノード編集ダイアログ
│   ├── EntryRuleEditor.tsx     # 到達ルール編集フォーム
│   ├── EntryRuleEditDialog.tsx # エッジクリック時の編集ダイアログ
│   └── Sidebar/
│       ├── index.tsx           # サイドバーコンテナ
│       └── NodeList.tsx        # ノード一覧・選択肢管理
├── domain/                   # ビジネスロジック（フレームワーク非依存）
│   ├── coverage.ts             # 網羅性チェック、競合検出
│   ├── numericRange.ts         # 数値範囲操作
│   ├── graphAnalysis.ts        # 経路解析
│   └── conditionFormatter.ts   # 条件フォーマット
├── lib/                      # フレームワーク依存ユーティリティ
│   ├── hooks/
│   │   ├── useFlowchartState.ts  # フローチャート状態管理
│   │   └── useDialogState.ts     # ダイアログ状態管理
│   └── flowchartGenerator.ts   # Mermaid コード生成
└── types/
    └── flowchart.ts          # 型定義
```

### データモデル

#### 主要な型

```typescript
// ノード定義
interface CustomNode {
  id: string;
  label: string;
  shape: NodeShape;
  questionCategory?: QuestionCategory;  // SA, MA, NA, FA
  choices?: ChoiceOption[];
  entryRules?: NodeEntryRule[];  // このノードへの到達ルール
}

// 到達ルール（エッジ情報をノードに埋め込み）
interface NodeEntryRule {
  id: string;
  sourceNodeId: string;           // 遷移元ノードID
  style?: EdgeStyle;              // solid, dashed, dotted
  visibilityCondition?: NodeVisibilityCondition;
}

// 条件タイプ
type NodeVisibilityCondition =
  | { type: 'choice'; choiceIds: string[] }         // 選択肢条件
  | { type: 'numeric'; numeric: NumericCondition }  // 数値条件
  | { type: 'compound'; compound: CompoundCondition } // 複合条件
  | { type: 'default' };                            // 無条件（または他の条件にマッチしない場合のフォールバック）
```

#### データフロー

```
CustomNode[] (entryRules 形式)
  ↓
useFlowchartState
  ├─ edges (動的生成: generateEdgesFromEntryRules)
  ├─ coverageResults (網羅性チェック結果)
  ├─ conflictMap (競合検出結果)
  └─ compoundCoverageMap (複合条件網羅性)
  ↓
FlowchartGenerator.generate()
  ↓
mermaidCode (文字列)
  ↓
FlowchartRenderer (SVG 描画)
```

### 主要機能

#### 1. 網羅性チェック（3層構造）

| レイヤー | 対象 | チェック内容 |
|---------|------|-------------|
| 選択肢網羅性 | SA/MA | すべての選択肢がエッジで使用されているか |
| 数値ギャップ | NA | 数値範囲全体をカバーしているか |
| 組み合わせ網羅性 | 複合条件 | 複数ノードの選択肢の組み合わせが網羅されているか |

#### 2. エッジ競合検出

| 競合タイプ | 説明 |
|-----------|------|
| exact | 完全に同じ条件 |
| partial | 部分的に重複 |
| subset | 一方がもう一方を包含 |

#### 3. エッジラベル自動生成

`visibilityCondition` から `conditionFormatter.ts` で自動生成:

| 条件タイプ | 生成例 |
|-----------|--------|
| choice | `選択肢1, 選択肢2` |
| numeric | `>= 100` |
| compound | `Node1: 選択肢A AND Node2: >= 50` |
| default | `条件なし` |

---

## 変更履歴

### 2025年1月

- エッジラベル自動生成機能の実装（`NodeEntryRule.label` 廃止）
- 網羅性チェックをラベル非依存に変更
- Sidebar からエッジ一覧を削除
- 未使用コードの削除

### 2024年12月

- entryRules ベースの新データモデルへ移行
- 状態ノード（`_state_` prefix）の廃止
- 複合条件の組み合わせ網羅性チェック実装
- エッジ競合検出機能の実装

### 2024年11月

- domain/ 配下へのビジネスロジック分離
- カスタムフック（useFlowchartState, useDialogState）の抽出
- 数値条件（NA）の網羅性チェック実装
