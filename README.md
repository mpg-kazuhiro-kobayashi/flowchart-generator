# Flowchart Generator

📊 Next.js + Mermaid.jsによるインタラクティブなフローチャート生成ツール

## 概要

JavaScript Objectから自動的にMermaidフローチャートを生成するビジュアルエディタです。ノードクリックによる条件分岐の追加、複合条件（AND条件）のサポート、設問カテゴリ（SA/MA/FA/NA）に対応した高度なフローチャート設計が可能です。

## 技術スタック

- **フレームワーク**: Next.js 15.4.4 (App Router)
- **描画ライブラリ**: Mermaid.js 11.9.0
- **UIライブラリ**: ReactFlow 11.11.4
- **状態管理**: Zustand 5.0.6
- **スタイリング**: Tailwind CSS 4
- **言語**: TypeScript 5

## 主要機能

✅ **実装済み機能**

### 基本機能
- JavaScript ObjectからMermaidフローチャートを自動生成
- ノードクリックによるインタラクティブな条件追加
- リアルタイムプレビュー表示
- 多様なノード形状（14種類）とエッジスタイル（9種類）

### 設問機能
- **SA（単一選択）**: 選択肢から1つを選択
- **MA（複数選択）**: 選択肢から複数を選択
- **FA（自由入力）**: テキスト入力（分岐不可）
- **NA（数値入力）**: 数値入力（条件分岐可能）

### 複合条件機能
- 複数の設問ノードの回答を組み合わせたAND条件
- 経路解析による適切な条件ノード提示
- 状態ノードの自動生成と管理
- SA/MA/NAの混合条件対応

### その他
- レスポンシブデザイン
- TypeScript完全対応
- エラーハンドリング
- ID検証機能

## ディレクトリ構成

```
/src
  /app
    page.tsx                      # メインページ
    layout.tsx                    # レイアウト
  /components
    FlowchartRenderer.tsx         # Mermaidフローチャート描画
    NodeEditDialog.tsx            # ノード編集ダイアログ
    AddConditionDialog.tsx        # 条件追加ダイアログ
  /lib
    flowchartGenerator.ts         # フローチャート生成ロジック
    graphUtils.ts                 # グラフ解析ユーティリティ
    validation.ts                 # バリデーション関数
  /types
    flowchart.ts                  # TypeScript型定義
/docs
  compound-condition.md           # 複合条件の実装仕様
  compound-condition-path-analysis.md  # 経路解析の実装方針
  node-deletion.md                # ノード削除機能の仕様
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

1. **ノード編集**: 左パネルでノードのID、ラベル、形状を編集
2. **設問タイプ設定**: ノードに設問カテゴリ（SA/MA/FA/NA）を設定
3. **選択肢管理**: SA/MAノードの場合、選択肢ボタンから選択肢を追加・編集
4. **エッジ編集**: 接続（エッジ）を手動で追加・編集
5. **リアルタイムプレビュー**: 右パネルでMermaidフローチャートをリアルタイム確認

### ノードクリックによる条件追加

1. **フローチャートのノードをクリック**: 右パネルのノードをクリックするとダイアログが開く
2. **接続先を選択**: 既存ノードまたは新規ノード作成を選択
3. **条件を設定**:
   - **単一条件**: そのノードからの直接的な遷移条件
   - **複合条件**: 複数の設問ノードの回答を組み合わせたAND条件
4. **エッジスタイルとラベル**: 矢印のスタイルとラベルを設定
5. **追加**: 条件が自動的にフローチャートに反映される

### 複合条件の使い方

1. **条件対象ノード**: 経路上に2つ以上のSA/MA/NAノードがある場合に利用可能
2. **複合条件を使用にチェック**: ダイアログで複合条件モードに切り替え
3. **各ノードの条件を設定**:
   - SA: 選択肢を1つ選択
   - MA: 選択肢を複数選択
   - NA: 演算子（=, >, <, >=, <=）と数値を入力
4. **状態ノードの自動生成**: システムが自動的に状態ノード（六角形）を生成し、条件を管理

## 核心技術実装

### フローチャート生成

```typescript
// FlowchartGenerator.ts
export class FlowchartGenerator {
  static generate(definition: FlowchartDefinition): string {
    // JavaScript ObjectからMermaidコードを生成
    return `flowchart ${definition.direction}\n${nodes}\n${edges}`;
  }
}
```

### 経路解析アルゴリズム

```typescript
// graphUtils.ts
export function getReachableQuestionNodes<T extends GraphNode>(
  targetNodeId: string,
  nodes: T[],
  edges: GraphEdge[]
): T[] {
  // DFS（深さ優先探索）で逆方向にエッジを辿り、
  // 経路上の設問ノード（SA/MA/NA）を収集
}
```

### 複合条件の状態管理

```typescript
// page.tsx
const handleAddCondition = (result: AddConditionResult) => {
  if (result.compoundCondition) {
    // 状態ノードを自動生成
    const stateNodeId = generateStateNodeId(result.compoundCondition.conditions);

    // 選択したノードから状態ノードへのエッジを作成
    // 状態ノードから接続先へのエッジを作成
  }
};
```

## 技術的特徴

### 経路解析による複合条件
- グラフの逆方向探索により、選択したノードに到達可能な設問ノードのみを提示
- 不要な条件選択を排除し、ユーザビリティを向上

### 状態ノードパターン
- 複合条件を状態ノード（`_state_` プレフィックス）で表現
- 同一条件の状態ノードは再利用され、グラフの複雑化を防止

### TypeScript型システム
- 完全な型定義により、コンパイル時エラー検出
- FlowchartDefinition型によるデータ構造の明確化

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

### GitHub Pagesデプロイ

このプロジェクトはGitHub Pagesに静的サイトとしてデプロイされています。

```bash
# 静的エクスポートとデプロイ
npm run build
```

デプロイ設定は `next.config.ts` と `.github/workflows/` を参照してください。

## プロジェクトの技術的課題と解決策

このプロジェクトは以下の技術課題を解決しています：

### 1. 複合条件の経路解析

**課題**: フローチャート全体で条件ノードが複数存在する場合、どのノードからでも複合条件が選択可能になってしまう

**解決策**: 深さ優先探索（DFS）による逆方向グラフ探索アルゴリズムを実装し、選択したノードに到達するまでの経路上にある設問ノードのみを提示
- 実装: `src/lib/graphUtils.ts` の `getReachableQuestionNodes`
- 詳細: `docs/compound-condition-path-analysis.md`

### 2. 複合条件のエッジ生成

**課題**: すべての条件ノードから状態ノードへのエッジを作成すると、誤った経路が生成される

**解決策**: 選択したノード（最後の設問ノード）から状態ノードへのエッジのみを作成し、エッジラベルにすべての複合条件を含める
- 実装: `src/app/page.tsx` の `handleAddCondition`
- 詳細: `docs/compound-condition-path-analysis.md`

### 3. 状態ノードの管理

**課題**: 複合条件を表現するための中間ノードの管理

**解決策**: `_state_` プレフィックスを持つ状態ノードを自動生成し、同一条件の状態ノードは再利用
- 六角形で視覚的に区別
- サイドパネルには表示しない
- 複合条件のメタデータを保持

### 4. Mermaidクリックイベントの取得

**課題**: Mermaid.jsで生成されたSVGノードからのクリックイベント取得

**解決策**: レンダリング後にSVG要素にイベントリスナーを動的に追加
- 実装: `src/components/FlowchartRenderer.tsx`

## ドキュメント

- `docs/compound-condition.md`: 複合条件機能の実装仕様
- `docs/compound-condition-path-analysis.md`: 経路解析の実装方針と修正履歴
- `docs/node-deletion.md`: ノード削除機能の仕様

## ライセンス

MIT License
