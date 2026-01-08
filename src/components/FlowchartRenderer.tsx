'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';

interface FlowchartRendererProps {
  mermaidCode: string;
  onNodeClick?: (nodeId: string) => void;
}

export default function FlowchartRenderer({ mermaidCode, onNodeClick }: FlowchartRendererProps) {
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

        // ノードIDからMermaidのノードIDを抽出
        // 形式: flowchart-{nodeId}-{index} または node-{nodeId}-{index}
        const match = nodeId.match(/(?:flowchart|node)-([^-]+)/);
        const extractedId = match ? match[1] : null;

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
  }, [onNodeClick]);

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

          // クリックイベントを追加
          addClickEventListeners();
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="error-box">描画エラー: ${error}</div>`;
        }
      }
    };

    renderMermaid();
  }, [mermaidCode, addClickEventListeners]);

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
      `}</style>
    </div>
  );
}
