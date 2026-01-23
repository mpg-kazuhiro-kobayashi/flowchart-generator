# デフォルトエッジ（フォールバック分岐）実装方針

## 背景・課題

### 現状の問題

MA（複数選択）の設問で選択肢が多い場合、すべての組み合わせに対してエッジを設定することが現実的ではない。

**例**: 10個の選択肢があるMAの場合
- 理論上の組み合わせ: 2^10 = 1,024通り
- 現状: すべての組み合わせに個別のエッジを設定する必要がある
- 問題: 網羅性チェックで常に警告が出る、設定が煩雑

### 解決策

**デフォルトエッジ（フォールバック）** を導入し、明示的な条件にマッチしない場合の遷移先を指定できるようにする。

---

## 現在の実装状況

### 実装済み

#### 1. 型定義（`src/types/flowchart.ts`）

`NodeVisibilityCondition` に `type: 'default'` が定義済み：

```typescript
export type NodeVisibilityCondition =
  | { type: 'always' }
  | { type: 'choice'; choiceIds: string[] }
  | { type: 'numeric'; numeric: NumericCondition }
  | { type: 'compound'; compound: CompoundCondition }
  | { type: 'default' };  // ← 実装済み
```

#### 2. UI（`src/components/EntryRuleEditor.tsx`）

条件タイプの選択肢に「デフォルト（その他）」が追加済み：

```typescript
<option value="default">デフォルト（その他）</option>
```

デフォルト条件の設定・編集が可能。

#### 3. ラベル自動生成（`src/domain/conditionFormatter.ts`）

デフォルト条件のラベル「その他」が生成される：

```typescript
case 'default':
  return 'その他';
```

### 未実装

#### 1. 網羅性チェックでのデフォルトエッジ考慮

現在の `checkChoiceCoverage`（`src/domain/coverage.ts`）はデフォルトエッジを考慮していない。

#### 2. デフォルトエッジの制約バリデーション

- 同一ソースノードから複数のデフォルトエッジを防ぐ制約

---

## 設計方針

### 1. デフォルトエッジの制約

1. **1ノードにつき1つまで**: 同一の設問ノードから複数のデフォルトエッジは設定不可
2. **設問ノードのみ**: デフォルトエッジは設問カテゴリ（SA/MA/NA）を持つノードからのみ設定可能
3. **FAは対象外**: 自由入力（FA）は分岐不可のため、デフォルトエッジも不要
4. **優先順位**: 条件付きエッジを先に評価し、どれにもマッチしない場合にデフォルトエッジを使用

### 2. 評価ロジック

```
遷移先の決定:
1. 条件付きエッジを順に評価
2. 条件にマッチするエッジがあれば、そのエッジで遷移
3. どの条件にもマッチしない場合:
   - デフォルトエッジがあれば、そのエッジで遷移
   - デフォルトエッジがなければ、遷移不可（エラー）
```

### 3. 網羅性チェックの変更

#### 現状のロジック（`checkChoiceCoverage`）

```typescript
// SA/MA: すべての選択肢がいずれかのエッジで使用されているか
// NA: 数値条件が全範囲をカバーしているか
```

#### 変更後のロジック

```typescript
// デフォルトエッジがある場合:
//   → 常に網羅されているとみなす（isCovered = true）
// デフォルトエッジがない場合:
//   → 現状のロジックを適用
```

---

## 実装計画

### Phase 1: 網羅性チェックの更新

**修正ファイル**: `src/domain/coverage.ts`

#### 1.1 `checkChoiceCoverage` 関数の修正

```typescript
export function checkChoiceCoverage<T extends GraphNode>(
  nodes: T[],
  edges: FlowchartEdge[]
): CoverageResult[] {
  // ...

  for (const node of questionNodes) {
    const outgoingEdges = edges.filter(edge => edge.from === node.id);

    // デフォルトエッジの存在をチェック
    const hasDefaultEdge = outgoingEdges.some(edge => {
      // エッジの元データ（entryRules）を参照して default 条件をチェック
      // → FlowchartEdge にはラベルしかないため、別の方法が必要
    });

    // デフォルトエッジがある場合は網羅されているとみなす
    if (hasDefaultEdge) {
      results.push({
        nodeId: node.id,
        // ...
        isCovered: true,  // デフォルトエッジがあれば常に true
      });
      continue;
    }

    // 以下、既存のロジック
    // ...
  }
}
```

#### 1.2 問題点: FlowchartEdge と NodeEntryRule の関係

現在の `checkChoiceCoverage` は `FlowchartEdge` を受け取るが、デフォルト条件は `NodeEntryRule.visibilityCondition` に格納されている。

**解決策**:
- `FlowchartEdge` を生成する際に、`visibilityCondition.type === 'default'` の情報を保持する
- または、`checkChoiceCoverage` に `CustomNode[]` を渡して `entryRules` から直接チェックする

#### 1.3 推奨アプローチ: CustomNode[] を使用

```typescript
export function checkChoiceCoverage<T extends GraphNode & { entryRules?: NodeEntryRule[] }>(
  nodes: T[],
  edges: FlowchartEdge[]
): CoverageResult[] {
  // ...

  for (const node of questionNodes) {
    // このノードから出るエッジ（このノードをソースとする entryRules を持つノード）を検索
    const outgoingRules: NodeEntryRule[] = [];
    for (const targetNode of nodes) {
      if (targetNode.entryRules) {
        const rulesFromThisNode = targetNode.entryRules.filter(r => r.sourceNodeId === node.id);
        outgoingRules.push(...rulesFromThisNode);
      }
    }

    // デフォルトエッジの存在をチェック
    const hasDefaultEdge = outgoingRules.some(
      rule => rule.visibilityCondition?.type === 'default'
    );

    if (hasDefaultEdge) {
      results.push({
        nodeId: node.id,
        questionCategory: node.questionCategory!,
        allChoices: node.choices || [],
        usedChoiceIds: [],
        unusedChoices: [],
        isCovered: true,
        hasOutgoingEdges: true,
        outgoingEdgeCount: outgoingRules.length,
      });
      continue;
    }

    // 以下、既存のロジック（edges を使用）
    // ...
  }
}
```

### Phase 2: デフォルトエッジの制約バリデーション

**修正ファイル**: `src/components/EntryRuleEditor.tsx`

#### 2.1 同一ソースノードからの重複デフォルトエッジを防ぐ

```typescript
// 既存のデフォルトエッジがあるかチェック
const existingDefaultEdge = useMemo(() => {
  // sourceNodeId からの既存エッジにデフォルトがあるか
  // → 親コンポーネントから情報を受け取る必要がある
}, [sourceNodeId, /* 既存ルール情報 */]);

// デフォルトオプションの表示条件
{!existingDefaultEdge && <option value="default">デフォルト（その他）</option>}
```

#### 2.2 UI での警告表示

既にデフォルトエッジが存在する場合:
- 条件タイプの選択肢から「デフォルト」を除外
- または、選択した場合にエラーメッセージを表示

### Phase 3: 複合条件との整合性

**修正ファイル**: `src/domain/coverage.ts` の `checkCompoundConditionCoverage`

デフォルトエッジがある場合、複合条件の組み合わせ網羅性チェックも緩和する:

```typescript
// デフォルトエッジがあれば、未カバーの組み合わせはデフォルトでカバーされる
if (hasDefaultEdge) {
  results.push({
    nodeId: node.id,
    hasCompoundConditions: true,
    relatedNodeIds: Array.from(relatedNodeIds),
    uncoveredCombinations: [],  // デフォルトがあれば空
    isFullyCovered: true,
  });
  continue;
}
```

---

## 動作確認

### テストケース1: MAの設問にデフォルトエッジ

1. Node 1（MA、選択肢: A, B, C, D, E）が存在
2. Node 1 → Node 2（選択肢A）を追加
3. Node 1 → Node 3（デフォルト）を追加
4. **期待**: 網羅性チェックがパス（isCovered = true）

### テストケース2: SAの設問に条件付きエッジ + デフォルトエッジ

1. Node 1（SA、選択肢: A, B, C）が存在
2. Node 1 → Node 2（選択肢A, B）を追加
3. Node 1 → Node 3（デフォルト）を追加
4. **期待**: 網羅性チェックがパス

### テストケース3: 同一ノードに2つ目のデフォルトエッジ

1. Node 1 → Node 2（デフォルト）が存在
2. Node 1 → Node 3（デフォルト）を追加しようとする
3. **期待**: エラーまたは「デフォルト」オプションが非表示

### テストケース4: NAの設問にデフォルトエッジ

1. Node 1（NA）が存在
2. Node 1 → Node 2（> 100）を追加
3. Node 1 → Node 3（デフォルト）を追加
4. **期待**: 網羅性チェックがパス（数値範囲外はデフォルトで遷移）

### テストケース5: 複合条件 + デフォルト

1. Node 1（SA）→ Node 2（MA）の経路が存在
2. Node 2 → Node 3（複合条件: Node1=A AND Node2=B）を追加
3. Node 2 → Node 4（デフォルト）を追加
4. **期待**: 複合条件の組み合わせ網羅性チェックがパス

---

## 考慮事項

### プレビューでのスタイル

デフォルトエッジを視覚的に区別する:
- 破線（dotted）スタイルを推奨
- ラベル「その他」で表示

### エッジ競合検出との関係

デフォルトエッジは他のエッジと競合しない（フォールバックなので）:
- `checkEdgeConditionConflicts` ではデフォルトエッジをスキップ

### 将来の拡張

- OR条件対応時の優先順位ルール

※ 以下は設計上不要と判断：
- ~~デフォルトエッジの条件付き設定~~ → 条件があるなら通常のエッジを使用すべき
- ~~デフォルトエッジの複数対応~~ → 「それ以外すべて」の行き先は論理的に1つのみ

---

## 参考: 他システムでの実装例

- **Google Forms**: 「その他」オプションで自由入力にフォールバック
- **Typeform**: 条件分岐で「それ以外の場合」を設定可能
- **プログラミング言語**: switch文の `default` ケース
