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
