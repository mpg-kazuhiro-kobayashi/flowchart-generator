# NA（数値入力）の網羅性チェック実装方針

## 概要

数値入力（NA）設問ノードの分岐条件が全数値範囲をカバーしているかを検証する機能。

## 問題の定義

### 網羅されている例

```
条件:
- age > 20 → 成人向け
- age <= 20 → 未成年向け

数直線:
←──────────[20]──────────→
   <= 20    │    > 20
     ✓      │      ✓

結果: 全範囲がカバーされている ✅
```

### 網羅されていない例

```
条件:
- age > 30 → シニア
- age < 10 → 子供

数直線:
←────[10]────────────[30]────→
  < 10  │  10~30(未定義)  │  > 30
   ✓    │       ✗        │    ✓

結果: 10 <= age <= 30 がカバーされていない ❌
```

## 設計

### 1. 数値範囲の表現

```typescript
interface NumericRange {
  /** 下限値（nullは負の無限大） */
  min: number | null;
  /** 下限を含むか */
  minInclusive: boolean;
  /** 上限値（nullは正の無限大） */
  max: number | null;
  /** 上限を含むか */
  maxInclusive: boolean;
}

// 例: age > 20
// { min: 20, minInclusive: false, max: null, maxInclusive: false }

// 例: 10 <= age <= 30
// { min: 10, minInclusive: true, max: 30, maxInclusive: true }
```

### 2. 演算子から範囲への変換

| 演算子 | 条件例 | NumericRange |
|--------|--------|--------------|
| `eq` (=) | x = 20 | `{ min: 20, minInclusive: true, max: 20, maxInclusive: true }` |
| `gt` (>) | x > 20 | `{ min: 20, minInclusive: false, max: null, maxInclusive: false }` |
| `gte` (>=) | x >= 20 | `{ min: 20, minInclusive: true, max: null, maxInclusive: false }` |
| `lt` (<) | x < 20 | `{ min: null, minInclusive: false, max: 20, maxInclusive: false }` |
| `lte` (<=) | x <= 20 | `{ min: null, minInclusive: false, max: 20, maxInclusive: true }` |

### 3. 範囲のマージとギャップ検出アルゴリズム

```typescript
/**
 * 複数の範囲が全数直線をカバーしているかチェック
 * @param ranges 条件から生成された範囲の配列
 * @returns ギャップ（未カバー範囲）の配列
 */
function findGaps(ranges: NumericRange[]): NumericRange[] {
  // 1. 範囲を下限値でソート
  const sorted = sortByMin(ranges);

  // 2. 範囲をマージ（重複・隣接する範囲を結合）
  const merged = mergeOverlappingRanges(sorted);

  // 3. マージ後の範囲間のギャップを検出
  const gaps: NumericRange[] = [];

  // 負の無限大から最初の範囲までのギャップ
  if (merged[0].min !== null) {
    gaps.push({
      min: null,
      minInclusive: false,
      max: merged[0].min,
      maxInclusive: !merged[0].minInclusive,
    });
  }

  // 範囲間のギャップ
  for (let i = 0; i < merged.length - 1; i++) {
    const current = merged[i];
    const next = merged[i + 1];

    if (hasGapBetween(current, next)) {
      gaps.push({
        min: current.max,
        minInclusive: !current.maxInclusive,
        max: next.min,
        maxInclusive: !next.minInclusive,
      });
    }
  }

  // 最後の範囲から正の無限大までのギャップ
  const last = merged[merged.length - 1];
  if (last.max !== null) {
    gaps.push({
      min: last.max,
      minInclusive: !last.maxInclusive,
      max: null,
      maxInclusive: false,
    });
  }

  return gaps;
}
```

### 4. 境界値の処理

#### 隣接する範囲の判定

```
範囲A: x <= 20  →  max: 20, maxInclusive: true
範囲B: x > 20   →  min: 20, minInclusive: false

→ ギャップなし（20は範囲Aに含まれ、20より大きい値は範囲Bに含まれる）
```

```
範囲A: x < 20   →  max: 20, maxInclusive: false
範囲B: x > 20   →  min: 20, minInclusive: false

→ ギャップあり（x = 20 がどちらにも含まれない）
```

#### 点の範囲（eq演算子）

```
範囲A: x < 20
範囲B: x = 20
範囲C: x > 20

→ 網羅されている
```

### 5. エッジからの条件収集

```typescript
interface NACondition {
  operator: NumericOperator;
  value: number;
  targetNodeId: string;
}

function collectNAConditions(
  nodeId: string,
  edges: GraphEdge[],
  stateNodes: StateNode[]
): NACondition[] {
  const conditions: NACondition[] = [];

  // 1. 直接のエッジから条件を収集
  for (const edge of edges) {
    if (edge.from === nodeId && edge.condition?.numericCondition) {
      conditions.push({
        operator: edge.condition.numericCondition.operator,
        value: edge.condition.numericCondition.value,
        targetNodeId: edge.to,
      });
    }
  }

  // 2. 複合条件（状態ノード）から条件を収集
  for (const stateNode of stateNodes) {
    for (const cond of stateNode.compoundCondition.conditions) {
      if (cond.nodeId === nodeId && cond.numericCondition) {
        conditions.push({
          operator: cond.numericCondition.operator,
          value: cond.numericCondition.value,
          targetNodeId: stateNode.id,
        });
      }
    }
  }

  return conditions;
}
```

## 実装タスク

1. [x] `NumericRange` 型と関連ユーティリティを `graphUtils.ts` に追加
2. [x] `operatorToRange()`: 演算子と値から範囲への変換関数
3. [x] `mergeRanges()`: 範囲のマージ関数
4. [x] `findNumericGaps()`: ギャップ検出関数
5. [x] `checkChoiceCoverage()` にNA網羅性チェックを統合
6. [x] `CoverageResult` に `numericGaps` フィールドを追加
7. [x] UI更新: ギャップがある場合の警告表示（サイドバー・ダイアログ）

## ギャップの表示形式

```
未カバー範囲:
- x < 10
- 20 < x <= 30
- x > 100
```

## エッジケース

### 1. 条件が1つだけの場合

```
条件: x > 20 のみ

ギャップ: x <= 20
→ 警告表示
```

### 2. eq（等価）演算子のみの場合

```
条件: x = 20 のみ

ギャップ: x < 20, x > 20
→ ほぼ全範囲がカバーされていない
```

### 3. 重複する条件

```
条件:
- x > 10
- x > 20

範囲マージ後: x > 10
ギャップ: x <= 10
```

### 4. 完全に重複する条件

```
条件:
- x >= 0
- x < 100
- x >= 50

マージ後: 0 <= x < 100
ギャップ: x < 0, x >= 100
```

## 制限事項

1. **整数/小数の区別なし**: すべての実数を対象とする
2. **上限/下限の設定なし**: 負の無限大から正の無限大までを対象とする
3. **複合条件のOR未対応**: 現在はAND条件のみ対応

## 将来の拡張

- [ ] ノードに数値の有効範囲（min/max）を設定可能にする
- [ ] 整数のみ/小数許容の設定
- [ ] OR条件への対応
