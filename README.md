# Flowchart Generator

📊 Next.js + Mermaid.js によるインタラクティブなフローチャート生成ツール

## 概要

JavaScript Object から自動的に Mermaid フローチャートを生成するビジュアルエディタです。ノードクリックによる条件分岐の追加、複合条件（AND条件）のサポート、設問カテゴリ（SA/MA/FA/NA）に対応した高度なフローチャート設計が可能です。

## 技術スタック

- **フレームワーク**: Next.js 15.4.4 (App Router)
- **描画ライブラリ**: Mermaid.js 11.9.0
- **スタイリング**: Tailwind CSS 4
- **言語**: TypeScript 5

## 主要機能

### 基本機能
- JavaScript Object から Mermaid フローチャートを自動生成
- ノードクリックによるインタラクティブな条件追加
- エッジクリックによる到達ルール編集
- リアルタイムプレビュー表示
- 多様なノード形状（14種類）とエッジスタイル（9種類）

### 設問機能
- **SA（単一選択）**: 選択肢から1つを選択
- **MA（複数選択）**: 選択肢から複数を選択
- **FA（自由入力）**: テキスト入力（分岐不可）
- **NA（数値入力）**: 数値入力（条件分岐可能）

### 複合条件機能
- 複数の設問ノードの回答を組み合わせた AND 条件
- 経路解析による適切な条件ノード提示
- SA/MA/NA の混合条件対応

### 網羅性チェック
- **選択肢網羅性（SA/MA）**: すべての選択肢がエッジで使用されているか検証
- **数値ギャップ検出（NA）**: 数値範囲全体をカバーしているか検証
- **複合条件組み合わせ網羅性**: 複数ノードの選択肢の組み合わせが網羅されているか検証

### エッジ競合検出
- **exact**: 完全に同じ条件の重複を検出
- **partial**: 部分的に重複する条件を検出
- **subset**: 一方がもう一方を包含する条件を検出

### エッジラベル自動生成
- 分岐条件（`visibilityCondition`）からラベルを自動生成
- ユーザーによるラベル編集は不要

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                    # メインページ
│   └── layout.tsx                  # レイアウト
├── components/
│   ├── FlowchartRenderer.tsx       # Mermaid フローチャート描画
│   ├── NodeEditDialog.tsx          # ノード編集ダイアログ
│   ├── EntryRuleEditor.tsx         # 到達ルール編集フォーム
│   ├── EntryRuleEditDialog.tsx     # エッジクリック時の編集ダイアログ
│   └── Sidebar/
│       ├── index.tsx               # サイドバーコンテナ
│       └── NodeList.tsx            # ノード一覧・選択肢管理
├── domain/                         # ビジネスロジック（フレームワーク非依存）
│   ├── coverage.ts                 # 網羅性チェック、競合検出
│   ├── numericRange.ts             # 数値範囲操作
│   ├── graphAnalysis.ts            # 経路解析
│   └── conditionFormatter.ts       # 条件フォーマット（ラベル自動生成）
├── lib/
│   ├── hooks/
│   │   ├── useFlowchartState.ts    # フローチャート状態管理
│   │   └── useDialogState.ts       # ダイアログ状態管理
│   ├── flowchartGenerator.ts       # Mermaid コード生成
│   └── uuid.ts                     # UUID 生成
└── types/
    └── flowchart.ts                # TypeScript 型定義

docs/                               # 実装方針ドキュメント
```

## セットアップ・起動

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

### 3. ブラウザでアクセス

[http://localhost:3000](http://localhost:3000) でアプリケーションを確認できます。

## 使用方法

### 基本操作

1. **ノード追加**: サイドバーの「ノードを追加」ボタンでノードを追加
2. **ノード編集**: サイドバーでノードのラベル、設問タイプを編集
3. **選択肢管理**: SA/MA ノードの場合、選択肢を追加・編集・削除
4. **到達ルール設定**: フローチャートのノードをクリックして到達ルールを設定
5. **リアルタイムプレビュー**: 右パネルで Mermaid フローチャートをリアルタイム確認

### ノードクリックによる到達ルール設定

1. **フローチャートのノードをクリック**: ノード編集ダイアログが開く
2. **到達ルールタブを選択**: 「到達ルール」タブで接続を管理
3. **新しいルールを追加**:
   - 接続元ノードを選択
   - 条件タイプを選択（無条件、選択肢、数値、複合条件、デフォルト）
   - 条件の詳細を設定
4. **保存**: ルールが自動的にフローチャートに反映される

### エッジクリックによるルール編集

1. **フローチャートのエッジラベルをクリック**: 到達ルール編集ダイアログが開く
2. **条件を編集**: 分岐条件を変更
3. **保存または削除**: 変更を保存、またはルールを削除

### 複合条件の使い方

1. **条件対象ノード**: 経路上に2つ以上の SA/MA/NA ノードがある場合に利用可能
2. **複合条件タイプを選択**: 到達ルール編集で「複合条件」を選択
3. **各ノードの条件を設定**:
   - SA/MA: 選択肢を選択
   - NA: 演算子（=, >, <, >=, <=）と数値を入力
4. **ラベル自動生成**: 条件に基づいてエッジラベルが自動生成される

## データモデル

### 主要な型

```typescript
// ノード定義
interface CustomNode {
  id: string;
  label: string;
  shape: NodeShape;
  questionCategory?: QuestionCategory;  // SA, MA, NA, FA
  choices?: ChoiceOption[];
  entryRules?: NodeEntryRule[];         // このノードへの到達ルール
}

// 到達ルール（エッジ情報をノードに埋め込み）
interface NodeEntryRule {
  id: string;
  sourceNodeId: string;                 // 遷移元ノードID
  style?: EdgeStyle;                    // solid, dashed, dotted
  visibilityCondition?: NodeVisibilityCondition;
}

// 条件タイプ
type NodeVisibilityCondition =
  | { type: 'always' }                              // 無条件
  | { type: 'choice'; choiceIds: string[] }         // 選択肢条件
  | { type: 'numeric'; numeric: NumericCondition }  // 数値条件
  | { type: 'compound'; compound: CompoundCondition } // 複合条件
  | { type: 'default' };                            // デフォルト（else）
```

### データフロー

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

## 核心技術実装

### フローチャート生成

```typescript
// flowchartGenerator.ts
export class FlowchartGenerator {
  static generate(definition: FlowchartDefinition): string {
    // CustomNode[] から Mermaid コードを生成
    return `flowchart ${definition.direction}\n${nodes}\n${edges}`;
  }

  static generateEdgesFromEntryRules(nodes: CustomNode[]): FlowchartEdge[] {
    // 各ノードの entryRules からエッジを動的生成
    // ラベルは visibilityCondition から自動生成
  }
}
```

### 経路解析アルゴリズム

```typescript
// domain/graphAnalysis.ts
export function getReachableQuestionNodes<T extends GraphNode>(
  targetNodeId: string,
  nodes: T[],
  edges: GraphEdge[]
): T[] {
  // DFS（深さ優先探索）で逆方向にエッジを辿り、
  // 経路上の設問ノード（SA/MA/NA）を収集
}
```

### 網羅性チェック

```typescript
// domain/coverage.ts
export function checkChoiceCoverage(nodes, edges): CoverageResult[] {
  // SA/MA: すべての選択肢がエッジで使用されているか
  // NA: 数値条件が全範囲をカバーしているか
}

export function checkCompoundConditionCoverage(nodes, edges): CompoundCoverageResult[] {
  // 複合条件の組み合わせ網羅性をチェック
}

export function checkEdgeConditionConflicts(nodes, edges): ConflictResult[] {
  // エッジ条件の競合を検出
}
```

### 条件フォーマット（ラベル自動生成）

```typescript
// domain/conditionFormatter.ts
export function formatCondition(
  condition: NodeVisibilityCondition,
  sourceNodeId: string,
  resolver: ConditionLabelResolver
): string {
  // visibilityCondition を人間が読める文字列に変換
  // 例: "選択肢1, 選択肢2" や ">= 100" や "Node1: 選択肢A AND Node2: >= 50"
}
```

## 技術的特徴

### entryRules ベースのデータモデル
- 各ノードが「どの条件で表示されるか」を `entryRules` として保持
- エッジ配列は動的に生成され、直接管理しない
- データの一貫性が保たれ、管理が容易

### 経路解析による複合条件
- グラフの逆方向探索により、選択したノードに到達可能な設問ノードのみを提示
- 不要な条件選択を排除し、ユーザビリティを向上

### ラベル自動生成
- `visibilityCondition` から `conditionFormatter.ts` でラベルを自動生成
- ユーザーが条件と異なるラベルを入力する不整合を防止
- 条件変更時にラベルが自動更新

### TypeScript 型システム
- 完全な型定義により、コンパイル時エラー検出
- `CustomNode` / `NodeEntryRule` / `NodeVisibilityCondition` によるデータ構造の明確化

## 開発・デプロイ

### ビルド

```bash
npm run build
```

### 本番サーバーの起動

```bash
npm run start
```

### Lint

```bash
npm run lint
```

### GitHub Pages デプロイ

このプロジェクトは GitHub Pages に静的サイトとしてデプロイできます。

```bash
npm run build
```

デプロイ設定は `next.config.ts` と `.github/workflows/` を参照してください。

## ドキュメント

詳細な実装方針は `docs/` ディレクトリを参照してください。

- [docs/README.md](./docs/README.md) - 実装方針ドキュメントの一覧と現在の実装状況

### 主要ドキュメント

| ドキュメント | 概要 |
|-------------|------|
| [node-embedded-conditions.md](./docs/node-embedded-conditions.md) | entryRules ベースの新データモデル |
| [compound-condition.md](./docs/compound-condition.md) | 複合条件（AND条件）の実装 |
| [auto-edge-label.md](./docs/auto-edge-label.md) | エッジラベル自動生成 |
| [edge-condition-conflict.md](./docs/edge-condition-conflict.md) | エッジ競合検出 |
| [compound-condition-coverage.md](./docs/compound-condition-coverage.md) | 複合条件の組み合わせ網羅性チェック |

## ライセンス

MIT License
