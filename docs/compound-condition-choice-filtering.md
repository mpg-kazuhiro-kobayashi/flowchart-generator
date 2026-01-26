# 複合条件の選択肢フィルタリング

## 概要

複合条件設定時に、経路上の制約を考慮して選択可能な選択肢を絞り込む機能の実装方針。

## 現状の問題

### 問題の再現手順

1. 以下のフローチャートを作成:
   - Q1(SA): 選択肢1-1, 選択肢1-2, 選択肢1-3
   - Q2(MA): 選択肢2-1, 選択肢2-2, 選択肢2-3
   - Q3(任意)
   - Q4(任意)

2. Q2 → Q3 へのエッジに複合条件を設定:
   - Q1: 選択肢1-1, 選択肢1-2
   - Q2: 選択肢2-2

3. Q3 → Q4 へのエッジで複合条件を設定しようとすると、Q1とQ2の**すべての選択肢**が選択可能になる

### 問題点

Q3 に到達するためには、既に以下の条件を満たしている必要がある:
- Q1: 選択肢1-1 または 選択肢1-2（選択肢1-3 は選択されていない）
- Q2: 選択肢2-2（選択肢2-1, 2-3 は選択されていない）

したがって、Q3 → Q4 の複合条件で選択肢1-3, 選択肢2-1, 選択肢2-3 を条件に含めても**論理的に到達不可能**である。

---

## 検討した案

### 案1: 選択可能な選択肢を絞り込む（採用）

経路上の条件を解析し、到達可能な選択肢のみを表示する。

**メリット:**
- 論理的に正しい
- ユーザーが無効な条件を設定するミスを防げる
- 網羅性チェックの計算も簡潔になる

**デメリット:**
- 実装が複雑になる（経路上のすべてのエッジ条件を解析して、到達可能な選択肢の組み合わせを計算する必要がある）
- 複数の経路がある場合、さらに複雑になる

### 案2: 選択肢は全て表示し、警告を出す

すべての選択肢を表示するが、到達不可能な条件を設定した場合に警告を表示する。

**メリット:**
- 実装がシンプル
- ユーザーが意図的に「到達不可能な条件」を設定したい場合に対応可能

**デメリット:**
- ユーザーがミスをする可能性がある
- 警告を無視される可能性がある

### 案3: 選択肢は全て表示し、到達可能な選択肢をハイライト

すべての選択肢を表示するが、到達可能な選択肢を視覚的に区別する。

**メリット:**
- 情報を隠さない
- ユーザーに判断を委ねつつ、ガイダンスを提供

**デメリット:**
- UIが複雑になる
- ユーザーが到達不可能な選択肢を選んでしまう可能性がある

### 採用理由

**案1を採用**する。

理由:
1. 到達不可能な条件を設定しても意味がない
2. 網羅性チェックの計算も簡潔になる
3. ユーザーの混乱を防げる
4. フローチャートの論理的整合性を保証できる

---

## 実装方針

### 1. 到達可能選択肢の計算ロジック

#### 1.1 基本アルゴリズム

```typescript
interface ReachableChoices {
  nodeId: string;
  choiceIds: string[];  // 到達可能な選択肢ID
}

function getReachableChoicesForNode(
  targetNodeId: string,
  allNodes: CustomNode[],
  allEdges: FlowchartEdge[]
): ReachableChoices[]
```

#### 1.2 計算手順

1. **対象ノードへの entryRules を取得**
   - 対象ノードの `entryRules` を取得

2. **各 entryRule について、経路上の条件を収集**
   - `sourceNodeId` から逆方向に辿り、各エッジの条件を収集
   - 再帰的に祖先ノードの条件も収集

3. **設問ノードごとに到達可能な選択肢を計算**
   - 条件が設定されていない設問ノード: すべての選択肢が到達可能
   - 条件が設定されている設問ノード: 条件で指定された選択肢のみ到達可能

4. **複数経路がある場合は和集合を取る**
   - 異なる経路から到達可能な選択肢の合計

#### 1.3 条件の種類ごとの処理

| 条件タイプ | 処理 |
|-----------|------|
| `choice` | `choiceIds` をそのまま使用 |
| `numeric` | 数値条件は選択肢に影響しない（NA用） |
| `compound` | 各 `SingleCondition` から選択肢を抽出 |
| `default` | すべての選択肢が到達可能（フォールバック） |

### 2. 新規関数の追加

#### 2.1 `src/domain/graphAnalysis.ts` に追加

```typescript
/**
 * 指定ノードに到達するために必要な選択肢の制約を計算
 *
 * @param targetNodeId 対象ノードID
 * @param allNodes 全ノード
 * @param allEdges 全エッジ（entryRulesから生成されたもの）
 * @returns 設問ノードごとの到達可能な選択肢
 */
export function getReachableChoicesConstraints(
  targetNodeId: string,
  allNodes: FlowchartNode[],
  allEdges: FlowchartEdge[]
): Map<string, Set<string>>
```

#### 2.2 処理フロー

```
getReachableChoicesConstraints(Q3, nodes, edges)
  │
  ├─ Q3 の entryRules を取得
  │   └─ rule: Q2 → Q3 (条件: Q1[1-1,1-2] AND Q2[2-2])
  │
  ├─ Q2 から逆方向に辿る
  │   └─ Q1 → Q2 のエッジ条件を確認
  │       └─ (条件なしまたは条件あり)
  │
  └─ 結果を返す
      ├─ Q1: [選択肢1-1, 選択肢1-2]  ← 複合条件で指定
      └─ Q2: [選択肢2-2]             ← 複合条件で指定
```

### 3. EntryRuleEditor の修正

#### 3.1 現在の実装

```typescript
// conditionNodes: 経路上の設問ノード（全選択肢を持つ）
const conditionNodes = useMemo((): ConditionNode[] => {
  const reachableNodes = getReachableQuestionNodes(sourceNodeId, allNodes, allEdges);
  // ...
  return reachableNodes.map(node => ({
    id: node.id,
    label: node.label,
    questionCategory: node.questionCategory,
    choices: node.choices,  // ← すべての選択肢
  }));
}, [sourceNodeId, allNodes, allEdges]);
```

#### 3.2 修正後の実装

```typescript
// conditionNodes: 経路上の設問ノード（到達可能な選択肢のみ）
const conditionNodes = useMemo((): ConditionNode[] => {
  const reachableNodes = getReachableQuestionNodes(sourceNodeId, allNodes, allEdges);

  // 対象ノード（編集中のノード）への到達制約を取得
  const choiceConstraints = getReachableChoicesConstraints(targetNodeId, allNodes, allEdges);

  return reachableNodes.map(node => {
    const allowedChoices = choiceConstraints.get(node.id);
    const filteredChoices = allowedChoices
      ? node.choices?.filter(c => allowedChoices.has(c.id))
      : node.choices;  // 制約がない場合はすべて

    return {
      id: node.id,
      label: node.label,
      questionCategory: node.questionCategory,
      choices: filteredChoices,
    };
  });
}, [sourceNodeId, targetNodeId, allNodes, allEdges]);
```

### 4. エッジケースの考慮

#### 4.1 複数経路がある場合

```
Q1 ─┬─ [選択肢1-1] ──→ Q2 ─┬─ [選択肢2-1] ──→ Q3
    │                      │
    └─ [選択肢1-2] ──→ Q2 ─┘
                           │
                           └─ [選択肢2-2] ──→ Q4
```

Q3 への経路が複数ある場合:
- 経路1: Q1[1-1] → Q2[2-1] → Q3
- 経路2: Q1[1-2] → Q2[2-1] → Q3

Q3 → Q4 の複合条件で選択可能な選択肢:
- Q1: [選択肢1-1, 選択肢1-2]（和集合）
- Q2: [選択肢2-1]（共通）

#### 4.2 デフォルトエッジ（条件なし）がある場合

```
Q1 ─┬─ [選択肢1-1] ──→ Q2
    │
    └─ [条件なし] ──→ Q2
```

デフォルトエッジは「他の条件にマッチしない場合」を意味するため:
- Q1 → Q2 のデフォルトエッジ経由の場合、Q1 の選択肢は [選択肢1-2, 選択肢1-3] が到達可能
  （選択肢1-1 以外）

**実装の簡略化**:
デフォルトエッジ経由の場合は、すべての選択肢を到達可能とみなす（厳密な計算は複雑になるため）。

#### 4.3 数値条件（NA）の扱い

数値条件は選択肢の制約には影響しない。数値条件を持つノードは複合条件の選択肢フィルタリング対象外。

#### 4.4 ルートノード

ルートノード（entryRules が空のノード）への経路は存在しないため、ルートノードの選択肢はすべて到達可能。

### 5. テストケース

#### テストケース1: 基本的な複合条件

```
Q1(SA) ─── [選択肢1-1, 1-2] ───→ Q2(MA) ─── [Q1:1-1,1-2 AND Q2:2-2] ───→ Q3
```

Q3 → Q4 の複合条件で:
- Q1: [選択肢1-1, 選択肢1-2] のみ選択可能
- Q2: [選択肢2-2] のみ選択可能

#### テストケース2: 条件なしエッジ

```
Q1(SA) ─── [条件なし] ───→ Q2(MA) ─── [Q2:2-1] ───→ Q3
```

Q3 → Q4 の複合条件で:
- Q1: すべての選択肢が選択可能（条件なしのため）
- Q2: [選択肢2-1] のみ選択可能

#### テストケース3: 複数経路

```
Q1(SA) ─┬─ [選択肢1-1] ───→ Q2(MA) ─── [Q2:2-1] ───→ Q3
        │
        └─ [選択肢1-2] ───→ Q2 ────────────────────────┘
```

Q3 → Q4 の複合条件で:
- Q1: [選択肢1-1, 選択肢1-2]（両経路の和集合）
- Q2: [選択肢2-1]（共通条件）

#### テストケース4: 単一条件エッジ（複合条件ではない）

```
Q1(SA) ─── [選択肢1-1] ───→ Q2(MA) ─── [選択肢2-1] ───→ Q3
```

Q3 → Q4 の複合条件で:
- Q1: [選択肢1-1] のみ選択可能
- Q2: [選択肢2-1] のみ選択可能

#### テストケース5: 新規ノードへの到達ルール追加

```
Q1(SA) ─── [選択肢1-1] ───→ Q2(MA)
```

新規ノード Q3 に Q2 → Q3 の到達ルールを追加する場合:
- Q1: [選択肢1-1] のみ選択可能（Q2 への経路で制約）
- Q2: すべての選択肢が選択可能（Q2 自身は制約なし）

---

## 実装順序

1. `src/domain/graphAnalysis.ts` に `getReachableChoicesConstraints()` 関数を追加
2. 単体テストで動作確認
3. `src/components/EntryRuleEditor.tsx` を修正して選択肢をフィルタリング
4. 統合テストで動作確認

---

## 将来の拡張

- デフォルトエッジの厳密な計算（補集合の計算）
- OR条件への対応
- 数値条件の範囲制約の伝播
