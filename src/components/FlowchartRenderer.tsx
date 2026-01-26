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

/** 競合エッジの識別情報 */
export interface ConflictingEdgeInfo {
  /** エッジのラベル */
  label: string;
  /** 接続元ノードID */
  fromNodeId: string;
  /** 接続先ノードID */
  toNodeId: string;
}

interface FlowchartRendererProps {
  mermaidCode: string;
  onNodeClick?: (nodeId: string) => void;
  /** エッジクリック時のコールバック */
  onEdgeClick?: (edgeInfo: EdgeClickInfo) => void;
  /** 未網羅のノードID配列 */
  uncoveredNodeIds?: string[];
  /** 競合しているエッジの情報 */
  conflictingEdges?: ConflictingEdgeInfo[];
  /** ノード追加時のコールバック */
  onAddNode?: () => void;
}

export default function FlowchartRenderer({ mermaidCode, onNodeClick, onEdgeClick, uncoveredNodeIds = [], conflictingEdges = [], onAddNode }: FlowchartRendererProps) {
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
    // nodeId にはハイフンが含まれる可能性があるため、末尾の数字部分を除去してからプレフィックスを削除
    // 例: "flowchart-exit-node-123" -> "exit-node"
    //     "flowchart-start-node-0" -> "start-node"
    const match = domNodeId.match(/(?:flowchart|node)-(.+)-\d+$/);
    return match ? match[1] : null;
  }, []);

  // エッジIDからfrom/toノードIDを抽出
  const extractEdgeNodeIds = useCallback((edgeElement: Element): { from?: string; to?: string } => {
    // MermaidのエッジIDは形式: L_A_B_0 (A→Bのエッジ) - アンダースコア区切り
    const id = edgeElement.id || '';

    // 形式: L_{from}_{to}_{数字} の最後の数字部分を除去
    const withoutIndex = id.replace(/_\d+$/, '');

    // L_ プレフィックスを除去
    const withoutPrefix = withoutIndex.replace(/^L_/, '');

    // 残りの部分をアンダースコアで分割
    const parts = withoutPrefix.split('_');
    if (parts.length >= 2) {
      // 最初の部分がfrom、残りがto
      const from = parts[0];
      const to = parts.slice(1).join('_');
      return { from, to };
    }
    return {};
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

  // 競合エッジにスタイルを適用
  const applyConflictingEdgeStyles = useCallback(() => {
    if (!containerRef.current) return;

    // Mermaid v10+ では edgePaths グループ内に path 要素が直接ある
    const edgePathsGroup = containerRef.current.querySelector('g.edgePaths');
    const edgePaths = edgePathsGroup ? edgePathsGroup.querySelectorAll('path.flowchart-link') : [];

    // edgeLabels グループの直接の子要素を取得（各エッジに1つずつ）
    const edgeLabelsGroup = containerRef.current.querySelector('g.edgeLabels');
    const edgeLabelGroups = edgeLabelsGroup ? Array.from(edgeLabelsGroup.children) : [];

    // 競合エッジのラベルセットを作成
    const conflictingLabels = new Set(conflictingEdges.map(ce => ce.label));

    // パスとラベルグループは同じインデックスで対応
    edgePaths.forEach((pathElement, index) => {
      const svgPath = pathElement as SVGPathElement;
      const labelGroup = edgeLabelGroups[index] as HTMLElement | undefined;
      const label = labelGroup?.textContent?.trim() || '';

      const isConflicting = label && conflictingLabels.has(label);

      if (isConflicting) {
        // 競合エッジの線を赤色にする
        svgPath.style.stroke = '#dc2626';
        svgPath.style.strokeWidth = '3px';
      } else {
        // スタイルをリセット
        svgPath.style.stroke = '';
        svgPath.style.strokeWidth = '';
      }
    });
  }, [conflictingEdges]);

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

  // エッジクリックイベントリスナーを追加
  const addEdgeClickEventListeners = useCallback(() => {
    if (!containerRef.current || !onEdgeClick) return;

    // Mermaid v10+ では g.edgePaths 内に path 要素が直接ある
    const edgePathsGroup = containerRef.current.querySelector('g.edgePaths');
    const edgeLabelsGroup = containerRef.current.querySelector('g.edgeLabels');

    // path 要素を取得（flowchart-link クラスを持つもの）
    const edgePaths = edgePathsGroup
      ? edgePathsGroup.querySelectorAll('path.flowchart-link')
      : containerRef.current.querySelectorAll('.edgePath');

    // ラベルを取得（edgeLabel クラスを持つ要素）
    const edgeLabels = edgeLabelsGroup
      ? edgeLabelsGroup.querySelectorAll('.edgeLabel')
      : containerRef.current.querySelectorAll('.edgeLabel');

    // エッジパスにクリックイベントを追加
    edgePaths.forEach((edgePath, index) => {
      const edgeElement = edgePath as HTMLElement;
      if (edgeElement.dataset.edgeClickAdded === 'true') return;
      edgeElement.dataset.edgeClickAdded = 'true';

      const handleEdgeClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        // 対応するラベルを取得（ラベルは2つずつあるので index でマッピング）
        // Mermaid v10+ ではラベルが重複している場合がある
        const labelElement = edgeLabels[index * 2] || edgeLabels[index];
        const label = labelElement?.textContent?.trim() || undefined;

        // from/toノードIDを抽出
        const { from, to } = extractEdgeNodeIds(edgePath);

        onEdgeClick({ edgeIndex: index, label, fromNodeId: from, toNodeId: to });
      };

      edgePath.addEventListener('click', handleEdgeClick);
    });

    // エッジラベルにもクリックイベントを追加
    // Mermaid v10+ ではラベルが2つずつ重複している（背景用と表示用）
    const uniqueLabels: Element[] = [];
    edgeLabels.forEach((label, index) => {
      // 偶数インデックスのラベルのみ処理（重複を除去）
      if (index % 2 === 0) {
        uniqueLabels.push(label);
      }
    });

    uniqueLabels.forEach((edgeLabel, index) => {
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

          // 競合エッジにスタイルを適用
          applyConflictingEdgeStyles();
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="error-box">描画エラー: ${error}</div>`;
        }
      }
    };

    renderMermaid();
  }, [mermaidCode, addClickEventListeners, addEdgeClickEventListeners, applyUncoveredStyles, applyConflictingEdgeStyles]);

  // uncoveredNodeIds が変更されたときにスタイルを再適用
  useEffect(() => {
    applyUncoveredStyles();
  }, [uncoveredNodeIds, applyUncoveredStyles]);

  // conflictingEdges が変更されたときにスタイルを再適用
  useEffect(() => {
    applyConflictingEdgeStyles();
  }, [conflictingEdges, applyConflictingEdgeStyles]);

  return (
    <div className="w-full h-full relative">
      {/* ノード追加ボタン */}
      {onAddNode && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onAddNode}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md flex items-center gap-2"
          >
            <span>+</span>
            <span>ノード追加</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full overflow-auto"
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

        /* SVG全体のスタイル - コンテナ内で中央配置 */
        svg {
          display: block;
          margin: 0 auto;
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

        /* 競合エッジのスタイル */
        .edgePath.conflicting path {
          stroke: #dc2626 !important;
          stroke-width: 3px !important;
        }

        .edgePath.conflicting marker path {
          fill: #dc2626 !important;
          stroke: #dc2626 !important;
        }

        .edgePath.conflicting {
          filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.5)) !important;
        }

        .edgeLabel.conflicting {
          background-color: #fef2f2 !important;
          border: 2px solid #dc2626 !important;
          border-radius: 4px !important;
        }

        .edgeLabel.conflicting foreignObject div {
          color: #dc2626 !important;
          font-weight: 600 !important;
        }

        .edgeLabel.conflicting .edgeLabel {
          background-color: #fef2f2 !important;
        }
      `}</style>
    </div>
  );
}
