# リファクタリング方針

**ステータス: 完了**

## 概要

本ドキュメントは、コードベースの保守性向上を目的としたリファクタリング計画を記載する。

## 実施結果サマリー

| 項目 | Before | After |
|------|--------|-------|
| `page.tsx` | 1,114行 | 444行 |
| `graphUtils.ts` | 474行 | 103行 |
| `AddConditionDialog.tsx` | 686行 | 削除 |

### 新規作成ファイル

| ファイル | 行数 | 説明 |
|---------|------|------|
| `hooks/useFlowchartState.ts` | 164行 | フローチャート状態管理 |
| `hooks/useDialogState.ts` | 121行 | ダイアログ状態管理 |
| `components/Sidebar/index.tsx` | 109行 | サイドバーコンテナ |
| `components/Sidebar/NodeList.tsx` | 261行 | ノード一覧 |
| `components/Sidebar/EdgeList.tsx` | 104行 | エッジ一覧 |
| `lib/numericRangeUtils.ts` | 222行 | 数値範囲操作 |
| `lib/coverageUtils.ts` | 172行 | 網羅性チェック |
| `lib/compoundConditionUtils.ts` | 56行 | 複合条件ロジック |

## 現状分析

### ファイルサイズと評価

| ファイル | 行数 | 評価 |
|---------|------|------|
| `src/app/page.tsx` | 1,114行 | **要分割** |
| `src/components/NodeEditDialog.tsx` | 949行 | **要分割** |
| `src/components/AddConditionDialog.tsx` | 686行 | 重複あり |
| `src/components/EdgeEditDialog.tsx` | 572行 | やや大きい |
| `src/lib/graphUtils.ts` | 474行 | 責務集中 |
| `src/components/FlowchartRenderer.tsx` | 323行 | 適正 |
| `src/lib/flowchartGenerator.ts` | 310行 | 適正 |

### 主な問題点

#### 1. page.tsx の肥大化（1,114行）

最も深刻な問題。以下の責務が1ファイルに混在している：

- グローバル状態管理（nodes, edges, dialogs）
- イベントハンドラ（20以上の関数）
- 派生データの計算（useMemo）
- UI定義（JSX）
- ビジネスロジック（状態ノード生成、ラベル生成）

#### 2. NodeEditDialog と AddConditionDialog の機能重複

両コンポーネントに「接続追加」機能が実装されており、複合条件のロジックが重複している。修正時に2箇所を変更する必要があり、バグの温床になる。

#### 3. 複合条件ロジックの散在

状態ノードID生成、ラベル生成、条件マージのロジックが以下のファイルに散らばっている：

- `page.tsx`
- `NodeEditDialog.tsx`
- `EdgeEditDialog.tsx`

#### 4. graphUtils.ts の責務集中

以下の異なる責務が1ファイルに集約されている：

- 数値範囲操作（operatorToRange, rangeToString, findNumericGaps）
- 網羅性チェック（checkChoiceCoverage）
- 経路解析（getReachableQuestionNodes）

## リファクタリング方針

### 目標ディレクトリ構造

```
src/
├── app/
│   └── page.tsx                    # UIレイアウトのみ（200行程度）
├── components/
│   ├── FlowchartRenderer.tsx       # 現状維持
│   ├── Sidebar/
│   │   ├── index.tsx               # サイドバーコンテナ
│   │   ├── NodeList.tsx            # ノード一覧
│   │   └── EdgeList.tsx            # エッジ一覧
│   ├── NodeEditDialog/
│   │   ├── index.tsx               # メインダイアログ
│   │   ├── NodeSettingsTab.tsx     # ノード設定タブ
│   │   └── ConnectionTab.tsx       # 接続追加タブ
│   ├── EdgeEditDialog/
│   │   ├── index.tsx               # メインダイアログ
│   │   ├── SingleConditionEditor.tsx   # 単一条件編集
│   │   └── CompoundConditionEditor.tsx # 複合条件編集
│   └── shared/
│       ├── ChoiceSelector.tsx      # 選択肢セレクター（共通）
│       └── NumericConditionInput.tsx # 数値条件入力（共通）
├── hooks/
│   ├── useFlowchartState.ts        # フローチャート状態管理
│   ├── useDialogState.ts           # ダイアログ状態管理
│   ├── useCoverageCheck.ts         # 網羅性チェック
│   ├── useReachableNodes.ts        # 経路解析
│   └── useMermaidCode.ts           # Mermaidコード生成
├── lib/
│   ├── flowchartGenerator.ts       # 現状維持
│   ├── graphUtils.ts               # 経路解析のみに縮小
│   ├── coverageUtils.ts            # 網羅性チェック
│   ├── numericRangeUtils.ts        # 数値範囲操作
│   ├── compoundConditionUtils.ts   # 複合条件ロジック集約
│   └── validation.ts               # 現状維持
└── types/
    └── flowchart.ts                # 現状維持
```

### フェーズ1: カスタムフックによる状態管理の整理（優先度: 高）

#### 1.1 フローチャート状態管理フックの作成

```typescript
// src/hooks/useFlowchartState.ts
import { useState, useCallback } from 'react';
import { CustomNode, CustomEdge } from '@/types/flowchart';

export function useFlowchartState(initialNodes: CustomNode[], initialEdges: CustomEdge[]) {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<CustomEdge[]>(initialEdges);

  // Node actions
  const addNode = useCallback((node: CustomNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const updateNode = useCallback((id: string, update: Partial<CustomNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...update } : n));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
  }, []);

  // Edge actions
  const addEdge = useCallback((edge: CustomEdge) => {
    setEdges(prev => [...prev, edge]);
  }, []);

  const updateEdge = useCallback((index: number, update: Partial<CustomEdge>) => {
    setEdges(prev => prev.map((e, i) => i === index ? { ...e, ...update } : e));
  }, []);

  const deleteEdge = useCallback((index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
  };
}
```

#### 1.2 ダイアログ状態管理フックの作成

```typescript
// src/hooks/useDialogState.ts
import { useState, useCallback } from 'react';

export function useDialogState() {
  // Node dialog
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const openNodeDialog = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsNodeDialogOpen(true);
  }, []);

  const closeNodeDialog = useCallback(() => {
    setIsNodeDialogOpen(false);
    setSelectedNodeId(null);
  }, []);

  // Edge dialog
  const [isEdgeDialogOpen, setIsEdgeDialogOpen] = useState(false);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);

  const openEdgeDialog = useCallback((index: number) => {
    setSelectedEdgeIndex(index);
    setIsEdgeDialogOpen(true);
  }, []);

  const closeEdgeDialog = useCallback(() => {
    setIsEdgeDialogOpen(false);
    setSelectedEdgeIndex(null);
  }, []);

  return {
    // Node dialog
    isNodeDialogOpen,
    selectedNodeId,
    openNodeDialog,
    closeNodeDialog,
    // Edge dialog
    isEdgeDialogOpen,
    selectedEdgeIndex,
    openEdgeDialog,
    closeEdgeDialog,
  };
}
```

### フェーズ2: ユーティリティの分割（優先度: 高）

#### 2.1 graphUtils.ts の分割

**numericRangeUtils.ts**
- `NumericRange` 型
- `operatorToRange()`
- `rangeToString()`
- `mergeRanges()`
- `findNumericGaps()`

**coverageUtils.ts**
- `CoverageResult` 型
- `checkChoiceCoverage()`
- `checkNumericCoverage()`

**graphUtils.ts（縮小版）**
- `getReachableQuestionNodes()`

#### 2.2 複合条件ロジックの集約

```typescript
// src/lib/compoundConditionUtils.ts
export const generateStateNodeId = (conditions: SingleCondition[]): string;
export const generateStateNodeLabel = (conditions: SingleCondition[], nodes: CustomNode[]): string;
export const generateCompoundConditionLabel = (conditions: SingleCondition[], nodes: CustomNode[]): string;
export const parseStateNodeId = (id: string): SingleCondition[] | null;
```

### フェーズ3: コンポーネントの分割（優先度: 中）

#### 3.1 page.tsx の分割

**Before (1,114行)**
```
page.tsx
├── 状態定義 (useState x 10+)
├── 派生データ (useMemo x 5+)
├── イベントハンドラ (useCallback x 15+)
├── サイドバーUI
├── フローチャートプレビュー
└── ダイアログ呼び出し
```

**After (200行程度)**
```
page.tsx
├── カスタムフック呼び出し
│   ├── useFlowchartState()
│   └── useDialogState()
├── レイアウト定義
│   ├── <Sidebar />
│   ├── <FlowchartRenderer />
│   ├── <NodeEditDialog />
│   └── <EdgeEditDialog />
└── 最小限のイベント委譲
```

#### 3.2 NodeEditDialog の分割

**NodeSettingsTab.tsx**
- ノードラベル編集
- 設問カテゴリ選択
- 選択肢の追加・削除・編集

**ConnectionTab.tsx**
- 接続先選択
- 条件設定（単一/複合）
- エッジスタイル選択

#### 3.3 共通コンポーネントの抽出

**ChoiceSelector.tsx**
- SA/MA の選択肢選択UI
- NodeEditDialog, EdgeEditDialog で共通利用

**NumericConditionInput.tsx**
- NA の数値条件入力UI
- 演算子選択 + 値入力

### フェーズ4: AddConditionDialog の統合（優先度: 中）

`AddConditionDialog.tsx` を削除し、`NodeEditDialog` の `ConnectionTab` に統合する。

### フェーズ5: 派生データ用フックの作成（優先度: 低）

```typescript
// src/hooks/useCoverageCheck.ts
export function useCoverageCheck(nodes: CustomNode[], edges: CustomEdge[]) {
  return useMemo(() => checkChoiceCoverage(nodes, edges), [nodes, edges]);
}

// src/hooks/useReachableNodes.ts
export function useReachableNodes(
  targetNodeId: string,
  nodes: CustomNode[],
  edges: CustomEdge[]
) {
  return useMemo(
    () => getReachableQuestionNodes(targetNodeId, nodes, edges),
    [targetNodeId, nodes, edges]
  );
}

// src/hooks/useMermaidCode.ts
export function useMermaidCode(nodes: CustomNode[], edges: CustomEdge[]) {
  return useMemo(
    () => FlowchartGenerator.generate({ direction: 'TD', nodes, edges }),
    [nodes, edges]
  );
}
```

## 実施順序

### Step 1: 基盤整備
1. カスタムフックの作成（`useFlowchartState.ts`, `useDialogState.ts`）
2. 複合条件ユーティリティの作成（`compoundConditionUtils.ts`）
3. graphUtils.ts の分割

### Step 2: page.tsx のリファクタリング
1. カスタムフックへの状態移行
2. Sidebar コンポーネントの抽出
3. イベントハンドラのフックへの移行

### Step 3: ダイアログの分割
1. NodeEditDialog のタブ分割
2. EdgeEditDialog の条件エディタ分割
3. 共通コンポーネントの抽出

### Step 4: 統合とクリーンアップ
1. AddConditionDialog の削除・統合
2. 不要コードの削除
3. 派生データ用フックの作成

## 期待される効果

### 保守性の向上
- 各ファイルが300行以下になり、理解しやすくなる
- 責務が明確になり、修正箇所が特定しやすくなる
- 重複コードが削減され、バグ修正が1箇所で済む

### テスタビリティの向上
- ユーティリティ関数が分離され、ユニットテストが書きやすくなる
- カスタムフックが独立し、テストが書きやすくなる

### 開発効率の向上
- 新規開発者の学習コストが下がる
- 機能追加時の影響範囲が限定される
- コードレビューがしやすくなる

## リスクと対策

### リスク1: リファクタリング中の機能デグレ
**対策**: フェーズごとに動作確認を行い、小さな単位でコミットする

### リスク2: 工数の増大
**対策**: フェーズ1（カスタムフック）を優先し、効果が高い部分から着手する

### リスク3: 新機能開発との競合
**対策**: リファクタリングブランチを作成し、定期的に main をマージする
