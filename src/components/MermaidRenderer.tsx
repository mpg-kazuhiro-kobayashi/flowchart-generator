'use client';

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useMindmapStore } from '@/store/mindmapStore';

interface MermaidRendererProps {
  mermaidCode: string;
}

export default function MermaidRenderer({ mermaidCode }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedNode, parseMermaidForNodeData } = useMindmapStore();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
      flowchart: {
        padding: 10,
      }
      // mindmap: {
      //   padding: 10,
      //   maxNodeSizeRatio: 0.5
      // }
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !mermaidCode.trim()) return;

    const renderMermaid = async () => {
      try {
        // ユニークIDを生成
        const id = `mermaid-${Date.now()}`;
        
        // Mermaid描画
        const { svg } = await mermaid.render(id, mermaidCode);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          
          // ノードデータをパース（サイドバー用）
          parseMermaidForNodeData(mermaidCode);
          
          // クリックイベントを追加
          addClickEventListeners();
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="error">描画エラー: ${error}</div>`;
        }
      }
    };

    renderMermaid();
  }, [mermaidCode, parseMermaidForNodeData]);

  const addClickEventListeners = () => {
    if (!containerRef.current) return;

    // SVG内のすべてのノードにクリックイベントを追加
    const nodes = containerRef.current.querySelectorAll('.mindmap-node, .node, [id*="node"], [class*="node"]');
    
    nodes.forEach((node, index) => {
      // 既にイベントリスナーが追加されている場合はスキップ
      if ((node as any)._clickAdded) return;
      (node as any)._clickAdded = true;
      
      const handleClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // ノードのテキスト内容を取得
        const textElement = node.querySelector('text, span, div');
        const nodeText = textElement?.textContent?.trim() || `node_${index}`;
        
        console.log('Clicked node:', nodeText, node);
        
        // 選択状態を設定
        setSelectedNode(nodeText);
        
        // 視覚的フィードバック
        nodes.forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
      };
      
      node.addEventListener('click', handleClick);
    });
  };

  return (
    <div className="w-full h-full relative">
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        style={{
          minHeight: '400px'
        }}
      />
      
      <style jsx global>{`
        .mindmap-node,
        .node,
        [id*="node"],
        [class*="node"] {
          cursor: pointer !important;
        }
        
        .mindmap-node:hover,
        .node:hover,
        [id*="node"]:hover,
        [class*="node"]:hover {
          opacity: 0.8;
        }
        
        .selected {
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) !important;
        }
        
        .error {
          color: #dc2626;
          padding: 20px;
          border: 2px solid #dc2626;
          border-radius: 8px;
          background: #fee2e2;
          font-family: monospace;
        }
        
        /* Mermaid mindmap specific styles */
        .mindmap-node text {
          font-size: 14px;
          font-weight: 500;
        }
        
        .mindmap svg {
          width: 100%;
          height: 100%;
          max-width: none;
        }
        
        /* Disable all transitions to prevent flickering */
        .mindmap-node *,
        .node *,
        [id*="node"] *,
        [class*="node"] * {
          transition: none !important;
          animation: none !important;
        }
      `}</style>
    </div>
  );
}