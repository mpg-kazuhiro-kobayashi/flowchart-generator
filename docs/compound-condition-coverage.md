# 複合条件の組み合わせ網羅性チェック 実装方針

## 概要

複合条件を持つエッジが存在する場合、単一ノードの選択肢網羅性だけでなく、**複数ノードの選択肢の組み合わせ**が網羅されているかをチェックする機能を実装する。

## 背景・課題

### 現在の網羅性チェック

現在の実装では、各ノードの選択肢が「使用されているか」のみをチェックしている：

```
Node 2 (SA: Yes, No)
├─ [Node 2: Yes AND Node 1: 選択肢1, 選択肢2] → Node 3
├─ [Node 2: Yes AND Node 1: 選択肢2] → Node 4
└─ [No] → Node 5
```

この場合、Node 2 の選択肢「Yes」と「No」は両方使用されているため、現在の実装では「網羅されている」と判定される。

### 問題点

しかし、複合条件の組み合わせを考慮すると：

| Node 1 の選択 | Node 2 の選択 | 分岐先 |
|--------------|--------------|--------|
| 選択肢1 | Yes | Node 3 ✓ |
| 選択肢2 | Yes | Node 3 または Node 4 ✓ |
| 選択肢3 | Yes | **なし ✗** |
| 選択肢1 | No | Node 5 ✓ |
| 選択肢2 | No | Node 5 ✓ |
| 選択肢3 | No | Node 5 ✓ |

「Node 1: 選択肢3」AND「Node 2: Yes」の組み合わせが網羅されていない。

## 実装方針

### 1. チェック対象の特定

複合条件エッジが存在するノードを特定し、そのノードから出るエッジの複合条件を収集する。

```typescript
// Node 2 から出るエッジの複合条件を分析
const outgoingEdges = edges.filter(e => e.from === node.id);
const compoundConditionEdges = outgoingEdges.filter(e => e.compoundCondition);
```

### 2. 関連ノードの選択肢マトリクス生成

複合条件に含まれるすべてのノードの選択肢を収集し、理論上の全組み合わせを生成する。

```typescript
// 複合条件に含まれるノードIDを収集
const relatedNodeIds = new Set<string>();
for (const edge of compoundConditionEdges) {
  for (const condition of edge.compoundCondition.conditions) {
    relatedNodeIds.add(condition.nodeId);
  }
}

// 各ノードの選択肢を取得
// Node 1: [選択肢1, 選択肢2, 選択肢3]
// Node 2: [Yes, No]

// 理論上の全組み合わせ（直積）
// (選択肢1, Yes), (選択肢1, No), (選択肢2, Yes), (選択肢2, No), (選択肢3, Yes), (選択肢3, No)
```

### 3. カバーされている組み合わせの特定

各エッジの条件がカバーする組み合わせを計算する。

```typescript
// Edge 1: [Node 2: Yes AND Node 1: 選択肢1, 選択肢2]
// カバー: (選択肢1, Yes), (選択肢2, Yes)

// Edge 2: [Node 2: Yes AND Node 1: 選択肢2]
// カバー: (選択肢2, Yes)

// Edge 3: [No] (単一条件、Node 2 のみ)
// カバー: (*, No) = (選択肢1, No), (選択肢2, No), (選択肢3, No)
```

### 4. 未カバーの組み合わせ検出

全組み合わせから、カバーされている組み合わせを除外し、残りを「未カバー」として報告する。

```typescript
// 全組み合わせ - カバー済み = 未カバー
// (選択肢3, Yes) が未カバー
```

### 5. 単一条件エッジの扱い

複合条件エッジと単一条件エッジが混在する場合：

- **単一条件エッジ**: そのノードの選択肢のみを条件とし、他のノードの選択肢は「すべて許容」（ワイルドカード）として扱う
- 例: `[No]` は `(*, No)` として解釈 = Node 1 の選択肢に関係なく Node 2 が No なら分岐

## データ構造

### 入力

```typescript
interface CompoundCoverageInput {
  /** チェック対象のノード */
  node: GraphNode;
  /** このノードから出るエッジ */
  outgoingEdges: GraphEdge[];
  /** 全ノード（関連ノードの選択肢取得用） */
  allNodes: GraphNode[];
}
```

### 出力

```typescript
interface CompoundCoverageResult {
  /** ノードID */
  nodeId: string;
  /** 複合条件の組み合わせ網羅性チェックが適用されるか */
  hasCompoundConditions: boolean;
  /** 関連するノードID */
  relatedNodeIds: string[];
  /** 未カバーの組み合わせ */
  uncoveredCombinations: {
    /** 各ノードの選択肢の組み合わせ */
    conditions: { nodeId: string; nodeLabel: string; choiceId: string; choiceLabel: string }[];
  }[];
  /** 組み合わせが完全に網羅されているか */
  isFullyCovered: boolean;
}
```

## UI 表示

### サイドバーでの警告表示

```
Node 2
設問タイプ: SA（単一選択）
選択肢から1つ選択

⚠️ 未網羅の条件組み合わせがあります
未網羅: Node 1: 選択肢3 AND Node 2: Yes
```

### フローチャートでのハイライト

- 複合条件の組み合わせが未網羅のノードにも既存の `uncovered` クラスを付与
- 詳細な違い（単一選択肢の未網羅 vs 組み合わせの未網羅）はサイドバーやダイアログで表示

## 実装ステップ

1. **`checkCompoundConditionCoverage` 関数の実装** (`src/domain/coverage.ts`)
   - 複合条件エッジの収集
   - 関連ノードの特定
   - 組み合わせマトリクスの生成
   - カバレッジ計算
   - 未カバー組み合わせの検出

2. **`useFlowchartState` の更新** (`src/lib/hooks/useFlowchartState.ts`)
   - `compoundCoverageResults` の追加
   - `compoundCoverageMap` の追加

3. **UI コンポーネントの更新**
   - `Sidebar/NodeList.tsx`: 未網羅組み合わせの警告表示
   - `NodeEditDialog.tsx`: 詳細情報の表示
   - `FlowchartRenderer.tsx`: `uncoveredNodeIds` の拡張

## 考慮事項

### パフォーマンス

- 組み合わせ数は選択肢数の積になるため、ノード数や選択肢数が多い場合は計算量が増大
- 必要に応じて遅延計算やメモ化を検討

### 複雑なケース

- 3つ以上のノードが関連する複合条件
- 数値条件（NA）を含む複合条件
- OR 条件（将来的な拡張）

### 単一条件との整合性

- 既存の単一ノード網羅性チェックとの併用
- 両方のチェック結果を統合して表示

## 実装優先度

1. **Phase 1**: 2ノードの選択肢条件の組み合わせチェック（今回のスコープ）
2. **Phase 2**: 3ノード以上の対応
3. **Phase 3**: 数値条件を含む複合条件の対応
