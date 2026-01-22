# ラベル非依存の網羅性チェック方針

## 背景
- `checkChoiceCoverage` / `checkCompoundConditionCoverage` では、エッジの `label` に含まれる文字列から選択肢 ID を推測しています。
- ラベルは UI から自由に編集できるため、「見た目の表記変更」によって網羅判定が揺らぐ・誤検知するリスクがある。
- 将来的にローカライズや自由記述が入ると文字列マッチは維持困難になる。

## 問題点
1. **誤判定リスク**: ラベルから選択肢名を削っただけで未網羅と扱われたり、偶然同じ文字列を含む別ラベルがヒットして誤検知する。
2. **メンテ性の低さ**: coverage ロジックが UI 表示用データと密結合し、仕様変更時の影響範囲が読めない。
3. **複合条件との不整合**: `getEdgeCoveredCombinations` でも fallback としてラベル文字列を参照しており、組み合わせ網羅判定の信頼性も下がる。

## ゴール
- 網羅性判定はエッジに紐づく構造化データ（`condition.choiceIds`, `compoundCondition`）のみを参照する。
- ラベル編集の影響を完全に排除し、UI 変更と coverage 判定を独立させる。

## 実装指針

### 1. EntryRule → Edge 変換の強化
- `FlowchartGenerator.generateEdgesFromEntryRules` / `entryRuleToEdge` にて、`NodeEntryRule.visibilityCondition` を `FlowchartEdge.condition` / `compoundCondition` に正規化して埋め込む。
  - `type === 'choice'`: `condition.choiceIds` を設定。
  - `type === 'numeric'`: `condition.numericCondition` に転写。
  - `type === 'compound'`: 既存の `CompoundCondition` を `edge.compoundCondition` に渡す。
  - `type === 'default'` / `always`: 条件なしのままにし、coverage では未指定扱いにする。
- これにより、coverage 側が「構造化された条件を必ず参照できる」前提を満たす。

### 2. coverage ロジックからラベル推測を撤廃
- `checkChoiceCoverage`
  - ラベル文字列を走査して `usedChoiceIds` に追加する処理を削除。
  - 単一条件 (`edge.condition.choiceIds`) と複合条件内の同一ノード条件だけを見る。
- `getEdgeCoveredCombinations`
  - 単一条件エッジのケースでラベルから選択肢 ID を抽出している分岐を削除。
  - 代わりに `edge.condition.choiceIds` が無い場合は「カバーなし」と判定する（構造化データ未設定＝未網羅）。
- `checkEdgeConditionConflicts`
  - 既にラベル非依存。`extractCondition` で構造化データ（`condition`, `compoundCondition`）のみを参照しているため、変更不要。

### 3. データ移行と安全策
- 既存データで `visibilityCondition` が `choice` / `numeric` なのに `label` だけ設定されていた場合、構造化データが落ちていないか確認。
  - もし UI 上で `visibilityCondition` が必ず設定されているなら追加作業不要。
  - 足りないケースがあるなら EntryRule 編集 UI で `choiceIds` を必須入力とする確認ステップを別途設ける。
- coverage 判定では `condition` が無いエッジを単純に「未カバー扱い」として維持し、従来ラベル頼りだったケースを早期にあぶり出す。

### 4. テスト / 検証

#### 4.1 EntryRule → Edge 変換テスト
| # | ケース | 入力 | 期待結果 |
|---|--------|------|----------|
| 1 | choice 条件 | `visibilityCondition.type === 'choice'` | `edge.condition.choiceIds` に選択肢ID配列が設定される |
| 2 | numeric 条件 | `visibilityCondition.type === 'numeric'` | `edge.condition.numericCondition` に演算子と値が設定される |
| 3 | compound 条件 | `visibilityCondition.type === 'compound'` | `edge.compoundCondition` に複合条件が設定される |
| 4 | always 条件 | `visibilityCondition.type === 'always'` | `edge.condition` が `undefined` |
| 5 | default 条件 | `visibilityCondition.type === 'default'` | `edge.condition` が `undefined` |

#### 4.2 網羅性チェックテスト
| # | ケース | 期待結果 |
|---|--------|----------|
| 1 | ラベル変更で結果不変 | `edge.label` を変更しても `checkChoiceCoverage` の結果が変わらない |
| 2 | 構造化データのみ参照 | `edge.condition.choiceIds` が設定されていれば網羅判定される |
| 3 | 条件未設定は未カバー | `edge.condition` が `undefined` のエッジは網羅対象外 |
| 4 | 複合条件の網羅判定 | `edge.compoundCondition` 内の条件が正しく網羅判定される |

#### 4.3 回帰テスト
- UI でラベルを編集しても、網羅性チェック結果（未使用選択肢、数値ギャップ）が変化しないことを確認。

## 今後のタスク例
1. EntryRule 変換ロジックの拡張実装。
2. coverage 関数のラベル参照削除と型の整理。
3. テスト整備と、サンプルデータ（`src/app/page.tsx`）の条件設定を構造化情報に統一。
4. 動作確認（UI でラベルを変えても網羅判定が変わらないことを確認）。
