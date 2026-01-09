/**
 * Mermaid Flowchart を JavaScript Object で表現するための型定義
 */

/** フローチャートの方向 */
export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';

/** ノードの形状 */
export type NodeShape =
  | 'rectangle'      // [text] - デフォルト
  | 'round'          // (text) - 角丸
  | 'stadium'        // ([text]) - スタジアム形
  | 'subroutine'     // [[text]] - サブルーチン
  | 'database'       // [(text)] - データベース（円筒形）
  | 'circle'         // ((text)) - 円形
  | 'doubleCircle'   // (((text))) - 二重円
  | 'asymmetric'     // >text] - 非対称形
  | 'rhombus'        // {text} - ひし形（条件分岐）
  | 'hexagon'        // {{text}} - 六角形
  | 'parallelogram'  // [/text/] - 平行四辺形
  | 'parallelogramAlt' // [\text\] - 逆平行四辺形
  | 'trapezoid'      // [/text\] - 台形
  | 'trapezoidAlt';  // [\text/] - 逆台形

/** 設問カテゴリ */
export type QuestionCategory =
  | 'SA'  // Single Answer - 単一選択
  | 'MA'  // Multiple Answer - 複数選択
  | 'FA'  // Free Answer - 自由入力（分岐不可）
  | 'NA'; // Numeric Answer - 数値入力

/** 選択肢（SA/MA用） */
export interface ChoiceOption {
  /** 選択肢ID */
  id: string;
  /** 選択肢のラベル */
  label: string;
}

/** 数値条件の比較演算子（NA用） */
export type NumericOperator =
  | 'eq'  // 等しい (==)
  | 'gt'  // より大きい (>)
  | 'lt'  // より小さい (<)
  | 'gte' // 以上 (>=)
  | 'lte'; // 以下 (<=)

/** 数値条件（NA用） */
export interface NumericCondition {
  operator: NumericOperator;
  value: number;
}

/**
 * 複合条件の単一条件
 * 特定の設問ノードに対する回答条件を表す
 */
export interface SingleCondition {
  /** 条件対象の設問ノードID */
  nodeId: string;
  /** 条件の種類 */
  conditionType: 'choice' | 'numeric';
  /** 選択肢条件（SA/MA用） */
  choiceCondition?: {
    /** 選択肢ID */
    choiceIds: string[];
    /** マッチタイプ（MAの場合） */
    matchType?: 'any' | 'all' | 'exact';
  };
  /** 数値条件（NA用） */
  numericCondition?: NumericCondition;
}

/**
 * 複合条件
 * 複数の設問ノードの回答を組み合わせた条件
 */
export interface CompoundCondition {
  /** 条件の配列 */
  conditions: SingleCondition[];
  /** 条件の結合方法（現在はANDのみ対応） */
  operator: 'AND';
}

/** 状態ノードのプレフィックス */
export const STATE_NODE_PREFIX = '_state_';

/** エッジ（矢印）のスタイル */
export type EdgeStyle =
  | 'solid'          // --> 実線矢印
  | 'dotted'         // -.-> 点線矢印
  | 'thick'          // ==> 太線矢印
  | 'solidNoArrow'   // --- 実線（矢印なし）
  | 'dottedNoArrow'  // -.- 点線（矢印なし）
  | 'thickNoArrow'   // === 太線（矢印なし）
  | 'biDirectional'  // <--> 双方向矢印
  | 'circleEnd'      // --o 丸で終端
  | 'crossEnd';      // --x Xで終端

/** フローチャートのノード */
export interface FlowchartNode {
  /** ノードID（一意の識別子） */
  id: string;
  /** ノードに表示するテキスト */
  label: string;
  /** ノードの形状 */
  shape?: NodeShape;
  /** スタイルクラス名 */
  className?: string;
  /** クリック時のコールバック関数名またはURL */
  click?: {
    type: 'callback' | 'link';
    target: string;
    tooltip?: string;
  };
  /** 設問カテゴリ（設問ノードの場合） */
  questionCategory?: QuestionCategory;
  /** 選択肢（SA/MAの場合） */
  choices?: ChoiceOption[];
}

/** エッジの分岐条件 */
export interface EdgeCondition {
  /** 選択肢IDによる条件（SA/MA用） - 指定した選択肢が選ばれた場合に遷移 */
  choiceIds?: string[];
  /** 数値条件（NA用） */
  numericCondition?: NumericCondition;
}

/** フローチャートのエッジ（接続線） */
export interface FlowchartEdge {
  /** 接続元ノードID */
  from: string;
  /** 接続先ノードID */
  to: string;
  /** エッジのスタイル */
  style?: EdgeStyle;
  /** エッジに表示するラベル */
  label?: string;
  /** 分岐条件（設問ノードからの遷移の場合） */
  condition?: EdgeCondition;
}

/** サブグラフ */
export interface FlowchartSubgraph {
  /** サブグラフID */
  id: string;
  /** サブグラフのタイトル */
  title: string;
  /** サブグラフに含まれるノードID */
  nodeIds: string[];
  /** サブグラフの方向（オプション） */
  direction?: FlowchartDirection;
}

/** スタイル定義 */
export interface FlowchartStyle {
  /** クラス名 */
  className: string;
  /** CSSスタイル（fill, stroke, stroke-width など） */
  styles: Record<string, string>;
}

/** リンクスタイル定義 */
export interface FlowchartLinkStyle {
  /** リンクのインデックス（定義順） */
  linkIndex: number;
  /** CSSスタイル */
  styles: Record<string, string>;
}

/** フローチャート全体の定義 */
export interface FlowchartDefinition {
  /** フローチャートの方向 */
  direction: FlowchartDirection;
  /** ノードの配列 */
  nodes: FlowchartNode[];
  /** エッジの配列 */
  edges: FlowchartEdge[];
  /** サブグラフの配列（オプション） */
  subgraphs?: FlowchartSubgraph[];
  /** スタイル定義（オプション） */
  styles?: FlowchartStyle[];
  /** リンクスタイル定義（オプション） */
  linkStyles?: FlowchartLinkStyle[];
  /** 初期設定（テーマなど） */
  init?: {
    theme?: 'default' | 'forest' | 'dark' | 'neutral' | 'base';
    themeVariables?: Record<string, string>;
  };
}
