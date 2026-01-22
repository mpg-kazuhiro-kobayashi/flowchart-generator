# エッジラベル自動生成

## 概要

エッジのラベルをユーザーが手動で編集する方式から、分岐条件（`visibilityCondition`）を元にアプリが自動生成する方式に変更する。

## 現状の仕組み

### データ構造

```typescript
interface NodeEntryRule {
  id: string;
  sourceNodeId: string;
  label?: string;              // ← ユーザー編集可能
  style?: EdgeStyle;
  visibilityCondition?: NodeVisibilityCondition;
}
```

### 現在のラベル決定フロー

1. EntryRuleEditor でユーザーが `label` を入力（任意）
2. 未入力の場合は `generateConditionLabel()` でプレースホルダー表示
3. 保存時に `finalLabel = label || generateConditionLabel()` で決定
4. `NodeEntryRule.label` に格納され、エッジ描画時に使用

### 問題点

- ユーザーが条件と異なるラベルを入力できる（不整合の可能性）
- 条件を変更してもラベルは自動更新されない
- ラベル編集UIが不要な複雑さを生んでいる

## 実装方針

### Phase 1: 条件フォーマットロジックの作成

`NodeEntryRule.label` フィールドを廃止し、`visibilityCondition` からラベルを動的に生成する。

#### 1.1 条件フォーマット関数の作成

`src/domain/conditionFormatter.ts` を新規作成:

```typescript
import {
  NodeVisibilityCondition,
  NumericOperator,
  SingleCondition,
} from '@/types/flowchart';

/** 数値演算子の表示シンボル */
const operatorSymbols: Record<NumericOperator, string> = {
  eq: '=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

/** 選択肢IDからラベルを解決するための型 */
export interface ConditionLabelResolver {
  getChoiceLabels: (nodeId: string, choiceIds: string[]) => string[];
  getNodeLabel?: (nodeId: string) => string | undefined;
}

/**
 * NodeVisibilityCondition を人間が読める文字列に変換
 */
export function formatCondition(
  condition: NodeVisibilityCondition | undefined,
  sourceNodeId: string,
  resolver: ConditionLabelResolver
): string {
  if (!condition) {
    return '';
  }

  switch (condition.type) {
    case 'always':
      return '';

    case 'default':
      return 'その他';

    case 'choice': {
      const labels = resolver.getChoiceLabels(sourceNodeId, condition.choiceIds);
      return labels.join(', ');
    }

    case 'numeric': {
      const symbol = operatorSymbols[condition.numeric.operator];
      return `${symbol} ${condition.numeric.value}`;
    }

    case 'compound': {
      return formatCompoundCondition(condition.compound.conditions, resolver);
    }
  }
}

/**
 * 複合条件を人間が読める文字列に変換
 */
function formatCompoundCondition(
  conditions: SingleCondition[],
  resolver: ConditionLabelResolver
): string {
  const parts: string[] = [];

  for (const cond of conditions) {
    const nodeLabel = resolver.getNodeLabel?.(cond.nodeId) || cond.nodeId;

    if (cond.choiceCondition) {
      const choiceLabels = resolver.getChoiceLabels(
        cond.nodeId,
        cond.choiceCondition.choiceIds
      );
      parts.push(`${nodeLabel}: ${choiceLabels.join(', ')}`);
    } else if (cond.numericCondition) {
      const symbol = operatorSymbols[cond.numericCondition.operator];
      parts.push(`${nodeLabel}: ${symbol} ${cond.numericCondition.value}`);
    }
  }

  return parts.join(' AND ');
}

/**
 * CustomNode[] から ConditionLabelResolver を作成
 */
export function createConditionLabelResolver(
  nodes: Array<{ id: string; label: string; choices?: Array<{ id: string; label: string }> }>
): ConditionLabelResolver {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return {
    getChoiceLabels: (nodeId: string, choiceIds: string[]) => {
      const node = nodeMap.get(nodeId);
      if (!node?.choices) return choiceIds;
      return choiceIds
        .map(id => node.choices?.find(c => c.id === id)?.label || id)
        .filter(Boolean);
    },
    getNodeLabel: (nodeId: string) => nodeMap.get(nodeId)?.label,
  };
}
```

#### 1.2 FlowchartGenerator の更新

`entryRuleToEdge` で条件フォーマット関数を使用:

```typescript
import { formatCondition, createConditionLabelResolver } from '@/domain/conditionFormatter';

// generateEdgesFromEntryRules 内で resolver を作成
static generateEdgesFromEntryRules(nodes: CustomNode[]): FlowchartEdge[] {
  const resolver = createConditionLabelResolver(nodes);
  const edges: FlowchartEdge[] = [];

  for (const node of nodes) {
    if (!node.entryRules || node.entryRules.length === 0) continue;

    for (const rule of node.entryRules) {
      edges.push(this.entryRuleToEdge(rule, node.id, resolver));
    }
  }

  return edges;
}

private static entryRuleToEdge(
  rule: NodeEntryRule,
  targetNodeId: string,
  resolver: ConditionLabelResolver
): FlowchartEdge {
  const label = formatCondition(
    rule.visibilityCondition,
    rule.sourceNodeId,
    resolver
  );

  const edge: FlowchartEdge = {
    from: rule.sourceNodeId,
    to: targetNodeId,
    style: rule.style || 'solid',
    label: label || undefined,  // 空文字の場合は undefined
  };
  // ... condition / compoundCondition 変換
}
```

### Phase 2: NodeEntryRule から label を削除

#### 2.1 型定義の更新

```typescript
interface NodeEntryRule {
  id: string;
  sourceNodeId: string;
  // label?: string;  ← 削除
  style?: EdgeStyle;
  visibilityCondition?: NodeVisibilityCondition;
}
```

#### 2.2 EntryRuleEditor の更新

- ラベル入力フィールドを削除
- `label` state を削除
- `generateConditionLabel()` 関数を削除（`formatCondition` に置き換え済み）

### Phase 3: 既存データのマイグレーション（任意）

既存の `NodeEntryRule.label` がある場合の処理:

1. **無視する**: `label` フィールドが残っていても無視し、常に自動生成
2. **削除する**: データ読み込み時に `label` を除去するマイグレーション処理

推奨: 無視するアプローチ（破壊的変更を避ける）

## 影響範囲

### 変更が必要なファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/domain/conditionFormatter.ts` | 新規作成 |
| `src/lib/flowchartGenerator.ts` | `entryRuleToEdge` で `formatCondition` を使用 |
| `src/types/flowchart.ts` | `NodeEntryRule.label` を削除（Phase 2） |
| `src/components/EntryRuleEditor.tsx` | ラベル入力フィールドを読み取り専用に変更 |
| `src/components/NodeEditDialog.tsx` | ラベル表示箇所の更新 |

### 変更不要なファイル

| ファイル | 理由 |
|---------|------|
| `src/domain/coverage.ts` | 前回のリファクタリングでラベル非依存化済み |
| `src/lib/hooks/useFlowchartState.ts` | エッジ生成を FlowchartGenerator に委譲済み |

## テスト観点

### 条件フォーマットのテストケース

| 条件タイプ | 入力 | 期待される出力 |
|-----------|------|---------------|
| `undefined` | - | `""` (空) |
| `always` | - | `""` (空) |
| `default` | - | `"その他"` |
| `choice` | 選択肢1, 選択肢2 | `"選択肢1, 選択肢2"` |
| `numeric` | `gte`, 100 | `">= 100"` |
| `compound` | Node1: 選択肢A AND Node2: >= 50 | `"Node1: 選択肢A AND Node2: >= 50"` |

### UIテスト

- [ ] 到達ルール追加時、ラベルプレビューが表示される
- [ ] 条件変更時、ラベルプレビューが即時更新される
- [ ] フローチャート上のエッジラベルが条件を正しく反映する

## 実装順序

1. `src/domain/conditionFormatter.ts` を作成しユニットテストを通す
2. `FlowchartGenerator.entryRuleToEdge` を更新
3. `EntryRuleEditor` からラベル入力を削除
4. `NodeEntryRule.label` を型定義から削除
5. 統合テストで全体動作を確認

## 懸念点

### ラベルのカスタマイズ需要

将来的にユーザーがラベルをカスタマイズしたい場合:
- `visibilityCondition` に `labelOverride?: string` を追加する
- 未指定時は自動生成、指定時はオーバーライド値を使用

### 長いラベルの折り返し

複合条件で条件数が多い場合、ラベルが長くなる:
- Mermaid の描画で折り返しが発生する可能性
- 必要に応じて省略表示（例: `条件1 AND 条件2 AND ...`）を検討
