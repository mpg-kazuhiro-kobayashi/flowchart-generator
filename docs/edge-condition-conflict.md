# エッジ条件競合チェック機能 実装方針

## 概要

同一ノードから出る複数のエッジが、同じ条件または重複する条件を持っている場合に、ユーザーに警告を表示する機能を実装する。

## 背景・課題

現在の実装では以下のチェックのみ行われている：

- **選択肢の網羅性チェック（SA/MA）**: すべての選択肢が少なくとも1つのエッジで使用されているか
- **数値条件のギャップ検出（NA）**: 数値範囲全体がカバーされているか

しかし、**同じ条件が複数のエッジで使用されている（競合している）** ことは検出されない。

### 検出されないシナリオ例

```
例1：同じ選択肢から複数エッジ（SA/MA）
Node A (SA: 選択肢1, 選択肢2)
├─ [選択肢1] → Node B
└─ [選択肢1] → Node C  ← 競合！検出されない

例2：数値条件の重複（NA）
Node A (NA)
├─ [>= 10] → Node B
└─ [>= 10] → Node C  ← 完全重複！検出されない

例3：数値条件の部分的重複（NA）
Node A (NA)
├─ [>= 10] → Node B
└─ [>= 5] → Node C   ← 部分的重複（10以上の範囲）！検出されない

例4：複合条件の完全一致
Node B
├─ [Node A: 選択肢1 AND Node B: YES] → Node C
└─ [Node A: 選択肢1 AND Node B: YES] → Node D  ← 完全一致！検出されない

例5：複合条件の包含関係（選択肢条件）
Node B
├─ [Node A: 選択肢1 AND Node B: YES] → Node C
└─ [Node A: 選択肢1, 選択肢2 AND Node B: YES] → Node D
  ↑ Node A で選択肢1、Node B で YES が選択された場合、両方のエッジが該当！
    （条件1は条件2に包含されている）

例6：複合条件の包含関係（数値条件）
Node B
├─ [Node A(NA): >= 10 AND Node B: YES] → Node C
└─ [Node A(NA): >= 5 AND Node B: YES] → Node D
  ↑ Node A が 10 以上、Node B で YES が選択された場合、両方のエッジが該当！
    （>= 10 の範囲は >= 5 の範囲に包含されている）

例7：通常条件（選択肢）と複合条件の競合
Node B (SA: YES, NO)
├─ [YES] → Node C                              ← 通常条件
└─ [Node A: 選択肢1 AND Node B: YES] → Node D  ← 複合条件
  ↑ Node A で選択肢1、Node B で YES が選択された場合、両方のエッジが該当！

例8：通常条件（数値）と複合条件の競合
Node B (NA)
├─ [>= 10] → Node C                             ← 通常条件
└─ [Node A: 選択肢1 AND Node B(NA): >= 5] → Node D  ← 複合条件
  ↑ Node A で選択肢1、Node B が 10 以上の場合、両方のエッジが該当！
    （通常条件 >= 10 は複合条件内の >= 5 に包含されている）
```

## 実装方針

### 1. 新規関数の追加

`src/domain/coverage.ts` に新しい関数 `checkEdgeConditionConflicts()` を追加する。

```typescript
/**
 * エッジ条件の競合をチェック
 */
export interface ConflictResult {
  /** ソースノードID */
  nodeId: string;
  /** 競合しているエッジのペア */
  conflicts: EdgeConflict[];
}

export interface EdgeConflict {
  /** 競合タイプ */
  type: 'exact' | 'partial' | 'subset';
  /** エッジ1の情報 */
  edge1: { to: string; label: string; isCompound: boolean };
  /** エッジ2の情報 */
  edge2: { to: string; label: string; isCompound: boolean };
  /** 競合している条件の説明 */
  description: string;
}

export function checkEdgeConditionConflicts(
  nodes: GraphNode[],
  edges: GraphEdge[]
): ConflictResult[];
```

### 2. 競合検出ロジック

#### SA/MA（選択肢条件）の競合検出

```typescript
// 同じノードから出るエッジの選択肢IDを比較
// 完全一致または部分的な重複を検出

// 例: edge1.choiceIds = ['opt1', 'opt2'], edge2.choiceIds = ['opt1']
// → 'opt1' が重複しているので競合
```

#### NA（数値条件）の競合検出

```typescript
// 数値範囲の重複を検出
// operatorToRange() で範囲に変換し、重複をチェック

// 例: edge1 = ">= 10", edge2 = ">= 5"
// → 10以上の範囲が重複しているので競合
```

#### 複合条件同士の競合検出

```typescript
// compoundCondition.conditions を比較
// 各ノードIDごとに条件を比較し、包含関係をチェック

// 例1（選択肢条件）:
// edge1: [Node A: 選択肢1 AND Node B: YES]
// edge2: [Node A: 選択肢1, 選択肢2 AND Node B: YES]

// Node A の条件比較:
//   edge1: ['選択肢1']
//   edge2: ['選択肢1', '選択肢2']
//   → edge1 の選択肢は edge2 に包含されている

// Node B の条件比較:
//   edge1: ['YES']
//   edge2: ['YES']
//   → 完全一致

// 結論: edge1 の条件がすべて edge2 に包含されているため、
//       edge1 が満たされる入力は必ず edge2 も満たす → 競合

// 例2（数値条件）:
// edge1: [Node A(NA): >= 10 AND Node B: YES]
// edge2: [Node A(NA): >= 5 AND Node B: YES]

// Node A の条件比較:
//   edge1: >= 10 → 範囲 [10, +∞)
//   edge2: >= 5  → 範囲 [5, +∞)
//   → edge1 の範囲は edge2 の範囲に包含されている

// Node B の条件比較:
//   edge1: ['YES']
//   edge2: ['YES']
//   → 完全一致

// 結論: edge1 の条件がすべて edge2 に包含されているため競合

// 競合判定ロジック:
// 1. 両方の複合条件に含まれるノードIDを列挙
// 2. 各ノードIDについて:
//    - 選択肢条件: 選択肢IDの包含関係をチェック
//    - 数値条件: 数値範囲の包含関係をチェック（rangeContains）
// 3. 一方の条件がもう一方に完全に包含されている場合は競合
```

#### 通常条件と複合条件の競合検出

```typescript
// 通常条件エッジと複合条件エッジを比較
// 複合条件の中に、ソースノード（from）に対する条件が含まれている場合、
// その条件と通常条件を比較する

// 例1（選択肢条件）: ソースノード = Node B (SA)
// edge1: condition = { choiceIds: ['yes'] }  ← 通常条件
// edge2: compoundCondition = {
//   conditions: [
//     { nodeId: 'Node A', choiceCondition: { choiceIds: ['opt1'] } },
//     { nodeId: 'Node B', choiceCondition: { choiceIds: ['yes'] } }  ← ソースノードの条件
//   ]
// }
// → edge2 の複合条件内に Node B: yes が含まれているため、
//   edge1 の通常条件 [yes] と競合する可能性がある

// 例2（数値条件）: ソースノード = Node B (NA)
// edge1: condition = { numericCondition: { operator: 'gte', value: 10 } }  ← 通常条件 >= 10
// edge2: compoundCondition = {
//   conditions: [
//     { nodeId: 'Node A', choiceCondition: { choiceIds: ['opt1'] } },
//     { nodeId: 'Node B', numericCondition: { operator: 'gte', value: 5 } }  ← ソースノードの条件 >= 5
//   ]
// }
// → edge1 の範囲 [10, +∞) は edge2 の範囲 [5, +∞) に包含されているため競合
//   （Node B が 10 以上の場合、両方のエッジが該当する可能性がある）
```

### 3. UI への統合

#### 3.1 CoverageResult の拡張

既存の `CoverageResult` インターフェースに競合情報を追加する。

```typescript
export interface CoverageResult {
  // ... 既存のプロパティ

  /** エッジ条件の競合 */
  edgeConflicts?: EdgeConflict[];
}
```

#### 3.2 警告表示の追加

`NodeEditDialog.tsx` と `Sidebar/NodeList.tsx` に競合警告を追加する。

```tsx
{coverageInfo?.edgeConflicts && coverageInfo.edgeConflicts.length > 0 && (
  <div className="p-2 bg-red-50 border border-red-300 rounded">
    <p className="text-sm text-red-800 font-medium">
      エッジ条件が競合しています
    </p>
    {coverageInfo.edgeConflicts.map((conflict, index) => (
      <p key={index} className="text-xs text-red-700">
        {conflict.description}
      </p>
    ))}
  </div>
)}
```

#### 3.3 FlowchartRenderer での視覚的フィードバック

競合しているエッジを赤色で表示するなどの視覚的フィードバックを検討する。

### 4. ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/coverage.ts` | `checkEdgeConditionConflicts()` 関数を追加 |
| `src/domain/coverage.ts` | `CoverageResult` に `edgeConflicts` を追加 |
| `src/lib/hooks/useFlowchartState.ts` | 競合チェック結果を `coverageResults` に統合 |
| `src/components/NodeEditDialog.tsx` | 競合警告の表示を追加 |
| `src/components/Sidebar/NodeList.tsx` | 競合警告の表示を追加 |

## 検出レベル

### 完全競合（exact）

- 同じ選択肢IDのセットが複数のエッジで使用されている
- 同じ数値条件（演算子と値）が複数のエッジで使用されている
- 同じ複合条件が複数のエッジで使用されている

### 部分的競合（partial）

- 選択肢IDの一部が重複している（例: `[opt1, opt2]` と `[opt1]`）
- 数値範囲が部分的に重複している（例: `>= 10` と `>= 5`）

### 包含競合（subset）

一方の条件がもう一方に完全に包含されている場合。包含される側の条件が満たされると、包含する側も必ず満たされるため競合となる。

- **通常条件 vs 複合条件（選択肢）**: 通常条件が複合条件の一部として含まれている
  - 例: 通常条件 `[YES]` と複合条件 `[Node A: 選択肢1 AND Node B: YES]`
- **通常条件 vs 複合条件（数値）**: 通常条件の数値範囲が複合条件の数値範囲に包含されている
  - 例: 通常条件 `[>= 10]` と複合条件 `[Node A: 選択肢1 AND Node B: >= 5]`
  - `>= 10` の範囲は `>= 5` の範囲に包含されている
- **複合条件 vs 複合条件（選択肢）**: 一方の選択肢条件がもう一方に包含されている
  - 例: `[Node A: 選択肢1 AND Node B: YES]` と `[Node A: 選択肢1, 選択肢2 AND Node B: YES]`
- **複合条件 vs 複合条件（数値）**: 一方の数値範囲がもう一方に包含されている
  - 例: `[Node A: >= 10 AND Node B: YES]` と `[Node A: >= 5 AND Node B: YES]`
  - 前者の条件が満たされる入力は、必ず後者も満たす

## 注意事項

- 競合チェックはソースノード単位で行う
- 異なるソースノードから出るエッジ間の競合はチェックしない
- パフォーマンスを考慮し、エッジ数が多い場合は O(n²) の計算量に注意

## 将来の拡張

- 競合を自動解消する機能
- 競合しているエッジをクリックで選択・編集できる機能
- デフォルトエッジ（else条件）との整合性チェック
