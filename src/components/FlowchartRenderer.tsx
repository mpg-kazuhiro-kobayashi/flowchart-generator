'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';

/** エッジクリック時に渡される情報 */
export interface EdgeClickInfo {
  /** エッジのインデックス（描画順） */
  edgeIndex: number;
  /** エッジのラベル（存在する場合） */
  label?: string;
  /** 接続元ノードID（取得できた場合） */
  fromNodeId?: string;
  /** 接続先ノードID（取得できた場合） */
  toNodeId?: string;
}

interface FlowchartRendererProps {
  mermaidCode: string;
  onNodeClick?: (nodeId: string) => void;
  /** エッジクリック時のコールバック */
  onEdgeClick?: (edgeInfo: EdgeClickInfo) => void;
  /** 未網羅のノードID配列 */
  uncoveredNodeIds?: string[];
}

export default function FlowchartRenderer({ mermaidCode, onNodeClick, onEdgeClick, uncoveredNodeIds = [] }: FlowchartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
      flowchart: {
        padding: 20,
        htmlLabels: true,
        curve: 'basis',
      },
    });
  }, []);

  // ノードIDを抽出するヘルパー関数
  const extractNodeId = useCallback((domNodeId: string): string | null => {
    // 形式: flowchart-{nodeId}-{index} または node-{nodeId}-{index}
    const match = domNodeId.match(/(?:flowchart|node)-([^-]+)/);
    return match ? match[1] : null;
  }, []);

  // 未網羅ノードにスタイルを適用
  const applyUncoveredStyles = useCallback(() => {
    if (!containerRef.current) return;

    const nodes = containerRef.current.querySelectorAll('.node');
    nodes.forEach((node) => {
      const nodeElement = node as HTMLElement;
      const extractedId = extractNodeId(nodeElement.id);

      if (extractedId && uncoveredNodeIds.includes(extractedId)) {
        nodeElement.classList.add('uncovered');
      } else {
        nodeElement.classList.remove('uncovered');
      }
    });
  }, [uncoveredNodeIds, extractNodeId]);

  const addClickEventListeners = useCallback(() => {
    if (!containerRef.current || !onNodeClick) return;

    // SVG内のすべてのノードにクリックイベントを追加
    const nodes = containerRef.current.querySelectorAll('.node');

    nodes.forEach((node) => {
      // 既にイベントリスナーが追加されている場合はスキップ
      if ((node as HTMLElement).dataset.clickAdded === 'true') return;
      (node as HTMLElement).dataset.clickAdded = 'true';

      const handleClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        // ノードのIDを取得（Mermaidが生成するID形式: flowchart-A-0 など）
        const nodeElement = node as HTMLElement;
        const nodeId = nodeElement.id;

        const extractedId = extractNodeId(nodeId);

        if (extractedId) {
          onNodeClick(extractedId);
        } else {
          // フォールバック: テキストから取得
          const textElement = node.querySelector('span, text, .nodeLabel');
          const nodeText = textElement?.textContent?.trim();
          if (nodeText) {
            onNodeClick(nodeText);
          }
        }
      };

      node.addEventListener('click', handleClick);
    });
  }, [onNodeClick, extractNodeId]);

  // エッジIDからfrom/toノードIDを抽出
  const extractEdgeNodeIds = useCallback((edgeElement: Element): { from?: string; to?: string } => {
    // MermaidのエッジIDは形式: L-A-B-0 (A→Bのエッジ)
    // ノードIDに_が含まれる場合もある: L-B-_state_xxx-0
    const id = edgeElement.id || '';

    // 形式: L-{from}-{to}-{数字} の最後の数字部分を除去
    const withoutIndex = id.replace(/-\d+$/, '');

    // L- プレフィックスを除去
    const withoutPrefix = withoutIndex.replace(/^L-/, '');

    // 残りの部分を最初の - で分割（ただし、_state_ で始まるノードIDに注意）
    // 戦略: ノードIDに - が含まれないと仮定して、最初の - で分割
    const parts = withoutPrefix.split('-');
    if (parts.length >= 2) {
      // 最初の部分がfrom、残りがto
      const from = parts[0];
      const to = parts.slice(1).join('-');
      return { from, to };
    }
    return {};
  }, []);

  // エッジクリックイベントリスナーを追加
  const addEdgeClickEventListeners = useCallback(() => {
    if (!containerRef.current || !onEdgeClick) return;

    // SVG内のすべてのエッジ（パスとラベル）にクリックイベントを追加
    // Mermaidはエッジを .edgePath クラスで描画し、ラベルは .edgeLabel クラス
    const edgePaths = containerRef.current.querySelectorAll('.edgePath');
    const edgeLabels = containerRef.current.querySelectorAll('.edgeLabel');

    // エッジパスにクリックイベントを追加
    edgePaths.forEach((edgePath, index) => {
      const edgeElement = edgePath as HTMLElement;
      if (edgeElement.dataset.edgeClickAdded === 'true') return;
      edgeElement.dataset.edgeClickAdded = 'true';

      const handleEdgeClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        // 対応するラベルを取得
        const labelElement = edgeLabels[index];
        const label = labelElement?.textContent?.trim() || undefined;

        // from/toノードIDを抽出
        const { from, to } = extractEdgeNodeIds(edgePath);

        onEdgeClick({ edgeIndex: index, label, fromNodeId: from, toNodeId: to });
      };

      edgePath.addEventListener('click', handleEdgeClick);
    });

    // エッジラベルにもクリックイベントを追加
    edgeLabels.forEach((edgeLabel, index) => {
      const labelElement = edgeLabel as HTMLElement;
      if (labelElement.dataset.edgeClickAdded === 'true') return;
      labelElement.dataset.edgeClickAdded = 'true';

      const handleLabelClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        const label = labelElement.textContent?.trim() || undefined;

        // 対応するエッジパスからfrom/toを取得
        const correspondingPath = edgePaths[index];
        const { from, to } = correspondingPath ? extractEdgeNodeIds(correspondingPath) : {};

        onEdgeClick({ edgeIndex: index, label, fromNodeId: from, toNodeId: to });
      };

      edgeLabel.addEventListener('click', handleLabelClick);
    });
  }, [onEdgeClick, extractEdgeNodeIds]);

  useEffect(() => {
    if (!containerRef.current || !mermaidCode.trim()) return;

    const renderMermaid = async () => {
      try {
        // ユニークIDを生成
        const id = `flowchart-${Date.now()}`;

        // Mermaid描画
        const { svg } = await mermaid.render(id, mermaidCode);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          // ノードクリックイベントを追加
          addClickEventListeners();

          // エッジクリックイベントを追加
          addEdgeClickEventListeners();

          // 未網羅ノードにスタイルを適用
          applyUncoveredStyles();
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="error-box">描画エラー: ${error}</div>`;
        }
      }
    };

    renderMermaid();
  }, [mermaidCode, addClickEventListeners, addEdgeClickEventListeners, applyUncoveredStyles]);

  // uncoveredNodeIds が変更されたときにスタイルを再適用
  useEffect(() => {
    applyUncoveredStyles();
  }, [uncoveredNodeIds, applyUncoveredStyles]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-auto"
        style={{
          minHeight: '400px',
        }}
      />

      <style jsx global>{`
        .node {
          cursor: pointer !important;
          transition: filter 0.15s ease-in-out !important;
        }

        .node:hover {
          filter: brightness(0.95) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1)) !important;
        }

        .node:active {
          filter: brightness(0.9) !important;
        }

        .node.selected {
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) !important;
        }

        /* 未網羅ノードのスタイル */
        .node.uncovered rect,
        .node.uncovered polygon,
        .node.uncovered circle,
        .node.uncovered ellipse,
        .node.uncovered path {
          stroke: #f59e0b !important;
          stroke-width: 3px !important;
        }

        .node.uncovered {
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.5)) !important;
        }

        .error-box {
          color: #dc2626;
          padding: 20px;
          border: 2px solid #dc2626;
          border-radius: 8px;
          background: #fee2e2;
          font-family: monospace;
        }

        /* ノード内のテキストスタイル */
        .node .nodeLabel {
          font-size: 14px;
          font-weight: 500;
        }

        /* SVG全体のスタイル */
        .flowchart svg {
          width: 100%;
          height: 100%;
          max-width: none;
        }

        /* エッジのスタイル */
        .edgePath {
          cursor: pointer !important;
          pointer-events: stroke !important;
        }

        .edgePath path {
          stroke-width: 2px !important;
          pointer-events: stroke !important;
        }

        .edgePath:hover path {
          stroke-width: 4px !important;
          filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.5)) !important;
        }

        .edgeLabel {
          cursor: pointer !important;
          pointer-events: all !important;
          z-index: 100 !important;
        }

        .edgeLabel:hover {
          filter: brightness(0.9) !important;
        }

        .edgeLabel foreignObject {
          pointer-events: all !important;
        }

        .edgeLabel foreignObject div {
          pointer-events: all !important;
        }
      `}</style>
    </div>
  );
}
