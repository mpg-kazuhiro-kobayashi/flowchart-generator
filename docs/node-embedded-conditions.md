# ノード内条件ベース構造への移行方針

## 1. 目的と背景

- 現行のデータモデルは `nodes[]` と `edges[]` を別々に持ち、エッジに単一/複合条件を直接ぶら下げている。
- 設問ノードの選択肢が増えるほど `edges[]` が肥大化し、条件の重複や編集対象の分散（ノード情報はNodeList、条件はEdgeList）が顕著になる。
- これを解消するため、**各ノードが「どの選択肢経路で表示されるか」を自身で保持**し、エッジ配列を廃止する。
- Mermaidへの出力は、ノードに埋め込まれた表示条件を走査して動的にエッジを復元する。

## 2. 新しいデータモデル

### 2.1 型定義（概案）

```ts
// src/types/flowchart.ts（抜粋）
export interface FlowchartNode {
  id: string;
  label: string;
  shape?: NodeShape;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
  /** このノードが表示される経路を表すルール */
  entryRules?: NodeEntryRule[];
}

export interface NodeEntryRule {
  /** UIで管理しやすいように一意IDを付与 */
  id: string;
  /** このノードへ到達する直前のノード */
  sourceNodeId: string;
  /** エッジラベル（Mermaid出力向け） */
  label?: string;
  /** 矢印スタイル */
  style?: EdgeStyle;
  /** 経路で選ばれた選択肢/値の組み合わせ */
  visibilityCondition?: NodeVisibilityCondition;
}

export type NodeVisibilityCondition =
  | { type: 'always' } // 無条件遷移
  | { type: 'choice'; choiceIds: string[] } // sourceNodeId自身の選択肢
  | { type: 'numeric'; numeric: NumericCondition }
  | { type: 'compound'; compound: CompoundCondition } // 既存SingleCondition[]を再利用
  | { type: 'default' }; // 他の条件にマッチしない場合（else分岐）
```

### 2.2 設計ルール

#### sourceNodeId について

- `sourceNodeId` は「Mermaid上でどのノードから矢印が出るか」を決定する。
- **複合条件であっても、矢印は `sourceNodeId` からのみ描画される**。複合条件内で参照している他のノードからは矢印を引かない。
- 例: 条件が「Q1=A AND Q2=Yes」の場合、`sourceNodeId` は `Q2` を指定し、Mermaid上では `Q2 → 結果ノード` の矢印のみが描画される。Q1からの矢印は描画されない。

#### ルートノード（開始ノード）について

- **ルートノードは `entryRules: []`（空配列）で表現する**。これが正規形である。
- `entryRules` が空または未定義のノードはフローチャート上の起点として扱う。
- **複数のルートノードは存在しない**。フローチャートには必ず1つの開始点がある。

#### デフォルトエッジ（else分岐）について

- 他の条件にマッチしない場合の分岐は `{ type: 'default' }` で表現する。
- これにより、SA/MAノードで「それ以外の選択肢すべて」を明示的に扱える。

### 2.3 visibilityCondition の統合

- `visibilityCondition` には、従来エッジに持たせていた `condition` / `compoundCondition` を統合して格納する。

### 2.4 Mermaidエッジの復元

1. `FlowchartGenerator.generate` 内で `nodes.flatMap(node => node.entryRules ?? [])` を行い、各 `NodeEntryRule` から `FlowchartEdge` を組み立てる。
2. ルートノード（`entryRules: []`）は、Mermaidの `graph TD` 直下にノード単体を配置する。
3. `visibilityCondition` を `label` に反映する場合は、既存の `generateCompoundConditionLabel` を流用し、`label` 未指定時のデフォルト文字列として用いる。

## 3. アプリケーション層の変更

### 3.1 状態管理 (`useFlowchartState`)

- `edges` ステートを削除し、`nodes` のみを保持。
- これまで `edges` に紐づいていた操作（追加/更新/削除）は、`entryRules` 配列を操作するユーティリティに置き換える。
- 網羅性チェック/競合チェック系の派生データは、`nodes` の `entryRules` から読み取るようリファクタリングする。
  - 例: SAノードの使用済み選択肢は、他ノードの `entryRules` で `visibilityCondition.type === 'choice' && rule.sourceNodeId === node.id` を抽出して判定。

### 3.2 ダイアログ/サイドバーUI

- `EdgeList` と `EdgeEditDialog` を廃止し、ノード編集ダイアログに「到達ルール（entryRules）」タブを追加する。
- ルール編集UIの振る舞い：
  1. ルールごとに `sourceNodeId` をドロップダウンで選択。
  2. 条件タイプ（単一/数値/複合/無条件/デフォルト）を切り替えるUIを用意。複合条件は既存の AND 条件編集UIを流用可能。
  3. 矢印ラベル・スタイルもルール単位で設定できるようにする。
- ノードクリックで開くダイアログでも、現状の「このノードから新しい接続を追加」ではなく、「このノードに到達するルールを追加/編集」へと文言と操作を変更する。

### 3.3 FlowchartRenderer

- 生成した `FlowchartDefinition.edges` をこれまで通りMermaidに渡すため、描画コンポーネントは大きな変更なし。
- ただし、`edgeConflicts` や `conflictingEdges` のソースが `entryRules` になるため、検出ロジックを新スキーマに合わせる。

## 4. ドメインロジックの改修

### 4.1 網羅性チェック

- `checkChoiceCoverage` / `checkCompoundConditionCoverage` は `edges` を参照していたため、ノード単位に再実装する。
- 具体的には「全ノードの `entryRules` を走査し、`rule.sourceNodeId === node.id` かつ `visibilityCondition` に対象ノードが含まれるケースを集計する」形に変更する。
- 数値条件(NA)のギャップ検出も同様に `entryRules` ベースで収集する。

### 4.2 競合検出

- 既存の `checkEdgeConditionConflicts` は `edges` の配列を受け取っていた。これを `entryRules` 配列に差し替え、`sourceNodeId` ごとにルールを比較するようにする。
- `visibilityCondition.type === 'compound'` の場合は、`compound.conditions` に含まれる `nodeId` をキーにして重複/部分一致を解析する。

### 4.3 経路解析

- `getReachableQuestionNodes` は「逆方向に辿る」ために `edges` の `from/to` を利用していた。新モデルでは「`entryRules` が参照している `sourceNodeId`」を逆参照マップとして構築する。
- 複合条件中で `sourceNodeId` 以外のノードを参照している場合も考慮し、`NodeVisibilityCondition` の内容からも依存関係グラフを構築する必要がある。

## 5. バリデーション

保存時に以下の検証を行う（`validation.ts` に実装）：

1. **sourceNodeId の存在確認**: `sourceNodeId` が存在するノードIDであること
2. **複合条件内の nodeId の存在確認**: `visibilityCondition.compound.conditions[].nodeId` がすべて存在するノードIDであること
3. **循環参照の検出**: A → B → A のような循環参照がないこと
4. **条件の矛盾検出**: 同一ノードに対して矛盾する条件（重複や排他）がないこと

## 6. ノード削除時の整合性

ノードを削除した場合、他ノードの `entryRules` 内で参照している当該ノードIDは**自動的に削除される**：

- `sourceNodeId` が削除対象のノードIDである `entryRules` は削除
- `visibilityCondition.compound.conditions[]` 内で削除対象の `nodeId` を参照している条件は削除

## 7. 実装フェーズ案

1. **型・ユーティリティ整備**
   - `FlowchartNode` と関連型の更新
2. **状態管理とドメイン層リファクタリング**
   - `useFlowchartState` をノード単独運用に変更
   - coverage/競合/経路解析ロジックを `entryRules` ベースに書き換え
3. **UIリプレイス**
   - Edge編集コンポーネント削除
   - NodeEditDialog に entryRules UI を実装
   - Sidebar から EdgeList を除去し、必要に応じて `entryRules` の簡易表示を追加
4. **Mermaid生成の更新**
   - `FlowchartGenerator` にエッジ生成ステップを追加
   - 既存の `compoundCondition` ラベル生成関数を `NodeEntryRule` と統合
5. **データ移行とテスト**
   - 既存デモデータを新形式へ書き換え
   - 各種ユースケース（単一条件 / 数値条件 / 複合条件 / デフォルト条件 / ルートノード）で描画と編集が成立するか検証

## 8. 想定されるAPIサンプル

```ts
const nodes: FlowchartNode[] = [
  {
    id: 'node1',
    label: 'Q1',
    shape: 'rectangle',
    questionCategory: 'SA',
    choices: [
      { id: 'opt1', label: '選択肢1' },
      { id: 'opt2', label: '選択肢2' },
    ],
    entryRules: [], // ルートノード
  },
  {
    id: 'node2',
    label: 'Q2',
    shape: 'rectangle',
    questionCategory: 'SA',
    choices: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
    entryRules: [
      {
        id: 'rule-node2',
        sourceNodeId: 'node1',
        visibilityCondition: { type: 'choice', choiceIds: ['opt1', 'opt2'] },
        label: '選択肢1, 選択肢2',
        style: 'solid',
      },
    ],
  },
  {
    id: 'node3',
    label: '結果A',
    shape: 'round',
    entryRules: [
      {
        id: 'rule-node3',
        sourceNodeId: 'node2',
        visibilityCondition: {
          type: 'compound',
          compound: {
            operator: 'AND',
            conditions: [
              { nodeId: 'node1', conditionType: 'choice', choiceCondition: { choiceIds: ['opt1'] } },
              { nodeId: 'node2', conditionType: 'choice', choiceCondition: { choiceIds: ['yes'] } },
            ],
          },
        },
        label: 'Q1=選択肢1 AND Q2=Yes',
        style: 'solid',
      },
    ],
  },
  {
    id: 'node4',
    label: '結果B',
    shape: 'round',
    entryRules: [
      {
        id: 'rule-node4',
        sourceNodeId: 'node2',
        visibilityCondition: { type: 'default' },
        label: 'その他',
        style: 'dashed',
      },
    ],
  },
];
```

- `FlowchartGenerator` はこの `entryRules` から以下のエッジを復元する：
  - `node1 -> node2`（選択肢1, 選択肢2）
  - `node2 -> node3`（Q1=選択肢1 AND Q2=Yes）
  - `node2 -> node4`（その他）
- UI上では node3 の「到達ルール」に `sourceNodeId=node2`、複合条件（Q1 + Q2）という形で表示され、編集可能。
- node4 は `type: 'default'` により、node2 から他の条件にマッチしない場合の分岐として表示される。

## 9. 留意点

- 既存の「状態ノード」概念は不要になり、複雑な条件でも node 自体が出現条件を持つ構造で表現できる。状態ノードが必要なケースが残るかを検証する。
- Mermaid上で同一ノードに複数の entryRule が存在する場合、`sourceNodeId` ごとに個別の矢印を描画する必要があるため、SVGイベントバインドはこれまで通りラベルや from/to をキーに解決する。

---
上記の方針に基づき、まずは型・ドメイン層を entryRules ベースへ書き換えたうえで、UIとジェネレータを段階的に対応させる。
