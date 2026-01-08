import {
  FlowchartDefinition,
  FlowchartNode,
  FlowchartEdge,
  FlowchartSubgraph,
  FlowchartStyle,
  FlowchartLinkStyle,
  NodeShape,
  EdgeStyle,
} from '@/types/flowchart';

/**
 * JavaScript Object から Mermaid フローチャート文字列を生成するクラス
 */
export class FlowchartGenerator {
  /**
   * FlowchartDefinition オブジェクトから Mermaid 形式の文字列を生成
   */
  static generate(definition: FlowchartDefinition): string {
    const lines: string[] = [];

    // 初期設定（テーマなど）
    if (definition.init) {
      lines.push(this.generateInitDirective(definition.init));
    }

    // フローチャート宣言
    lines.push(`flowchart ${definition.direction}`);

    // ノードの定義
    for (const node of definition.nodes) {
      lines.push(`    ${this.generateNode(node)}`);
    }

    // エッジの定義
    for (const edge of definition.edges) {
      lines.push(`    ${this.generateEdge(edge)}`);
    }

    // サブグラフの定義
    if (definition.subgraphs) {
      for (const subgraph of definition.subgraphs) {
        lines.push(...this.generateSubgraph(subgraph));
      }
    }

    // スタイル定義
    if (definition.styles) {
      for (const style of definition.styles) {
        lines.push(`    ${this.generateStyleDef(style)}`);
      }
    }

    // リンクスタイル定義
    if (definition.linkStyles) {
      for (const linkStyle of definition.linkStyles) {
        lines.push(`    ${this.generateLinkStyle(linkStyle)}`);
      }
    }

    // クリックイベント定義
    for (const node of definition.nodes) {
      if (node.click) {
        lines.push(`    ${this.generateClickEvent(node)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 初期設定ディレクティブを生成
   */
  private static generateInitDirective(init: FlowchartDefinition['init']): string {
    if (!init) return '';

    const config: Record<string, unknown> = {};
    if (init.theme) config.theme = init.theme;
    if (init.themeVariables) config.themeVariables = init.themeVariables;

    return `%%{init: ${JSON.stringify(config)}}%%`;
  }

  /**
   * ノード定義を生成
   */
  private static generateNode(node: FlowchartNode): string {
    const shape = node.shape || 'rectangle';
    const nodeText = this.wrapNodeText(node.label, shape);

    let result = `${node.id}${nodeText}`;

    // クラス名を追加
    if (node.className) {
      result += `:::${node.className}`;
    }

    return result;
  }

  /**
   * ノードテキストを形状に応じた記法でラップ
   */
  private static wrapNodeText(text: string, shape: NodeShape): string {
    const escapedText = this.escapeText(text);

    switch (shape) {
      case 'rectangle':
        return `[${escapedText}]`;
      case 'round':
        return `(${escapedText})`;
      case 'stadium':
        return `([${escapedText}])`;
      case 'subroutine':
        return `[[${escapedText}]]`;
      case 'database':
        return `[(${escapedText})]`;
      case 'circle':
        return `((${escapedText}))`;
      case 'doubleCircle':
        return `(((${escapedText})))`;
      case 'asymmetric':
        return `>${escapedText}]`;
      case 'rhombus':
        return `{${escapedText}}`;
      case 'hexagon':
        return `{{${escapedText}}}`;
      case 'parallelogram':
        return `[/${escapedText}/]`;
      case 'parallelogramAlt':
        return `[\\${escapedText}\\]`;
      case 'trapezoid':
        return `[/${escapedText}\\]`;
      case 'trapezoidAlt':
        return `[\\${escapedText}/]`;
      default:
        return `[${escapedText}]`;
    }
  }

  /**
   * テキストをエスケープ（特殊文字対応）
   */
  private static escapeText(text: string): string {
    // ダブルクォートで囲む必要がある特殊文字を含む場合
    if (text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '#quot;')}"`;
    }
    return text;
  }

  /**
   * エッジラベル用のエスケープ処理
   * Mermaid.js では > や < がマークダウンとして解釈されるため、
   * HTMLエンティティに変換する
   */
  private static escapeEdgeLabel(text: string): string {
    return text
      .replace(/>/g, '&gt;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * エッジ定義を生成
   */
  private static generateEdge(edge: FlowchartEdge): string {
    const style = edge.style || 'solid';
    const arrow = this.getArrowSyntax(style);

    if (edge.label) {
      // ラベルをエスケープしてから使用
      const escapedLabel = this.escapeEdgeLabel(edge.label);
      // ラベル付きエッジ
      return `${edge.from} ${arrow}|${escapedLabel}| ${edge.to}`;
    }

    return `${edge.from} ${arrow} ${edge.to}`;
  }

  /**
   * エッジスタイルに応じた矢印記法を取得
   */
  private static getArrowSyntax(style: EdgeStyle): string {
    switch (style) {
      case 'solid':
        return '-->';
      case 'dotted':
        return '-.->';
      case 'thick':
        return '==>';
      case 'solidNoArrow':
        return '---';
      case 'dottedNoArrow':
        return '-.-';
      case 'thickNoArrow':
        return '===';
      case 'biDirectional':
        return '<-->';
      case 'circleEnd':
        return '--o';
      case 'crossEnd':
        return '--x';
      default:
        return '-->';
    }
  }

  /**
   * サブグラフ定義を生成
   */
  private static generateSubgraph(subgraph: FlowchartSubgraph): string[] {
    const lines: string[] = [];

    lines.push(`    subgraph ${subgraph.id}[${subgraph.title}]`);

    if (subgraph.direction) {
      lines.push(`        direction ${subgraph.direction}`);
    }

    for (const nodeId of subgraph.nodeIds) {
      lines.push(`        ${nodeId}`);
    }

    lines.push('    end');

    return lines;
  }

  /**
   * スタイル定義を生成
   */
  private static generateStyleDef(style: FlowchartStyle): string {
    const styleStr = Object.entries(style.styles)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `classDef ${style.className} ${styleStr}`;
  }

  /**
   * リンクスタイル定義を生成
   */
  private static generateLinkStyle(linkStyle: FlowchartLinkStyle): string {
    const styleStr = Object.entries(linkStyle.styles)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `linkStyle ${linkStyle.linkIndex} ${styleStr}`;
  }

  /**
   * クリックイベント定義を生成
   */
  private static generateClickEvent(node: FlowchartNode): string {
    if (!node.click) return '';

    const { type, target, tooltip } = node.click;
    const tooltipStr = tooltip ? ` "${tooltip}"` : '';

    if (type === 'callback') {
      return `click ${node.id} call ${target}()${tooltipStr}`;
    } else {
      return `click ${node.id} "${target}"${tooltipStr}`;
    }
  }
}

/**
 * ヘルパー関数：シンプルなフローチャートを簡単に作成
 */
export function createSimpleFlowchart(
  nodes: Array<{ id: string; label: string; shape?: NodeShape }>,
  connections: Array<{ from: string; to: string; label?: string }>
): FlowchartDefinition {
  return {
    direction: 'TD',
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.label,
      shape: n.shape || 'rectangle',
    })),
    edges: connections.map(c => ({
      from: c.from,
      to: c.to,
      label: c.label,
    })),
  };
}

/**
 * ヘルパー関数：条件分岐フローを作成
 */
export function createDecisionFlow(
  decisionNode: { id: string; label: string },
  yesPath: { nodeId: string; label: string },
  noPath: { nodeId: string; label: string }
): Partial<FlowchartDefinition> {
  return {
    nodes: [
      { id: decisionNode.id, label: decisionNode.label, shape: 'rhombus' },
      { id: yesPath.nodeId, label: yesPath.label },
      { id: noPath.nodeId, label: noPath.label },
    ],
    edges: [
      { from: decisionNode.id, to: yesPath.nodeId, label: 'Yes' },
      { from: decisionNode.id, to: noPath.nodeId, label: 'No' },
    ],
  };
}
