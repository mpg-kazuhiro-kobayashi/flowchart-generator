# リファクタリング方針（フェーズ2）

## 目的

ビジネスロジックとフレームワーク依存コードを明確に分離し、保守性を向上させる。

## 現状の課題

### 1. lib/ 配下の責務が混在

現在の `lib/` には性質の異なるコードが混在している：

| ファイル | 性質 |
|---------|------|
| `coverageUtils.ts` | 純粋なビジネスロジック |
| `numericRangeUtils.ts` | 純粋なビジネスロジック |
| `compoundConditionUtils.ts` | 純粋なビジネスロジック |
| `graphUtils.ts` | 純粋なビジネスロジック |
| `validation.ts` | 純粋なビジネスロジック |
| `flowchartGenerator.ts` | Mermaid 依存 |

### 2. hooks/ の配置

`src/hooks/` が `src/lib/` と同階層にあり、関連性が分かりにくい。

### 3. page.tsx にビジネスロジックが残存

`handleAddCondition` 内に複合条件ラベル生成ロジックが含まれている。

## 目標ディレクトリ構造

```
src/
├── app/
│   └── page.tsx
├── components/              # 現状維持
│   ├── Sidebar/
│   ├── NodeEditDialog.tsx
│   ├── EdgeEditDialog.tsx
│   └── FlowchartRenderer.tsx
├── domain/                  # ビジネスロジック（純粋関数のみ、フレームワーク非依存）
│   ├── coverage.ts          # 網羅性チェック
│   ├── numericRange.ts      # 数値範囲操作
│   ├── compoundCondition.ts # 複合条件ロジック
│   ├── graphAnalysis.ts     # 経路解析
│   └── validation.ts        # バリデーション
├── lib/
│   ├── hooks/               # React Hooks
│   │   ├── useFlowchartState.ts
│   │   └── useDialogState.ts
│   └── flowchartGenerator.ts  # 現状維持（Mermaid 依存）
└── types/
    └── flowchart.ts
```

## 設計方針

### domain/ の役割

- フレームワーク（React, Next.js, Mermaid）に一切依存しない
- 純粋関数のみで構成される
- 単体テストが容易

### lib/ の役割

- フレームワーク依存のユーティリティ
- React Hooks は `lib/hooks/` に配置
- `flowchartGenerator.ts` は現状維持

### components/ の役割

- UI コンポーネント
- 現状の配置を維持

## 実施内容

### Step 1: domain/ ディレクトリの作成

1. `src/domain/` ディレクトリを作成
2. 以下のファイルを移動・リネーム：
   - `lib/coverageUtils.ts` → `domain/coverage.ts`
   - `lib/numericRangeUtils.ts` → `domain/numericRange.ts`
   - `lib/compoundConditionUtils.ts` → `domain/compoundCondition.ts`
   - `lib/graphUtils.ts` → `domain/graphAnalysis.ts`
   - `lib/validation.ts` → `domain/validation.ts`

### Step 2: hooks/ の移動

1. `src/hooks/` → `src/lib/hooks/` に移動
2. インポートパスを更新

### Step 3: page.tsx のビジネスロジック移動

1. `handleAddCondition` 内のラベル生成ロジックを `domain/compoundCondition.ts` に移動
2. `page.tsx` から関数呼び出しに置換

### Step 4: インポートパスの更新

1. 全ファイルのインポートパスを新構造に合わせて更新
2. ビルド確認

## 期待される効果

### 意図の明確化

- `domain/` を見れば「フレームワーク非依存のビジネスロジック」と分かる
- `lib/` は「フレームワーク依存のユーティリティ」と分かる

### テスタビリティの向上

- `domain/` 配下は React なしで単体テスト可能

### 保守性の向上

- ビジネスロジックの変更が UI に影響しにくい
- 新規開発者が構造を理解しやすい

## 実施しない方針

- `infrastructure/` ディレクトリの導入（Next.js 前提のため不要）
- `application/useCases/` の導入（プロジェクト規模に対して過剰）
- `components/` の移動（現状で問題なし）
- `flowchartGenerator.ts` の移動（現状維持）
