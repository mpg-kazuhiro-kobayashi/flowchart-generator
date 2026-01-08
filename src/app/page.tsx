'use client';

import { useState, useMemo, useCallback } from 'react';
import FlowchartRenderer from '@/components/FlowchartRenderer';
import AddConditionDialog from '@/components/AddConditionDialog';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { FlowchartDefinition, FlowchartNode, NodeShape, EdgeStyle } from '@/types/flowchart';

// 利用可能なノード形状
const nodeShapes: { value: NodeShape; label: string }[] = [
  { value: 'rectangle', label: '四角形 [text]' },
  { value: 'round', label: '角丸 (text)' },
  { value: 'stadium', label: 'スタジアム ([text])' },
  { value: 'subroutine', label: 'サブルーチン [[text]]' },
  { value: 'database', label: 'データベース [(text)]' },
  { value: 'circle', label: '円 ((text))' },
  { value: 'doubleCircle', label: '二重円 (((text)))' },
  { value: 'rhombus', label: 'ひし形 {text}' },
  { value: 'hexagon', label: '六角形 {{text}}' },
  { value: 'parallelogram', label: '平行四辺形 [/text/]' },
  { value: 'trapezoid', label: '台形 [/text\\]' },
];

// 利用可能なエッジスタイル
const edgeStyles: { value: EdgeStyle; label: string }[] = [
  { value: 'solid', label: '実線矢印 -->' },
  { value: 'dotted', label: '点線矢印 -.->' },
  { value: 'thick', label: '太線矢印 ==>' },
  { value: 'solidNoArrow', label: '実線 ---' },
  { value: 'biDirectional', label: '双方向 <-->' },
  { value: 'circleEnd', label: '丸終端 --o' },
  { value: 'crossEnd', label: 'X終端 --x' },
];

export default function Home() {
  // カスタムエディター用の状態
  const [customNodes, setCustomNodes] = useState<Array<{ id: string; label: string; shape: NodeShape }>>([
    { id: 'A', label: 'Start', shape: 'stadium' },
    { id: 'B', label: 'Process', shape: 'rectangle' },
    { id: 'C', label: 'End', shape: 'stadium' },
  ]);
  const [customEdges, setCustomEdges] = useState<Array<{ from: string; to: string; label: string; style: EdgeStyle }>>([
    { from: 'A', to: 'B', label: '', style: 'solid' },
    { from: 'B', to: 'C', label: '', style: 'solid' },
  ]);

  // ダイアログ用の状態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<FlowchartNode | null>(null);

  // フローチャート定義
  const currentDefinition = useMemo((): FlowchartDefinition => {
    return {
      direction: 'TD' as const,
      nodes: customNodes,
      edges: customEdges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.label || undefined,
        style: e.style,
      })),
    };
  }, [customNodes, customEdges]);

  // Mermaid文字列を生成
  const mermaidCode = useMemo(() => {
    return FlowchartGenerator.generate(currentDefinition);
  }, [currentDefinition]);

  // ノードクリック時のハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    // クリックされたノードを探す
    const node = currentDefinition.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedSourceNode(node);
      setIsDialogOpen(true);
    } else {
      // ラベルで検索（フォールバック）
      const nodeByLabel = currentDefinition.nodes.find(n => n.label === nodeId);
      if (nodeByLabel) {
        setSelectedSourceNode(nodeByLabel);
        setIsDialogOpen(true);
      }
    }
  }, [currentDefinition.nodes]);

  // 条件追加のハンドラ
  const handleAddCondition = useCallback((condition: {
    targetNodeId: string;
    label: string;
    style: EdgeStyle;
    createNewNode?: { id: string; label: string };
  }) => {
    if (!selectedSourceNode) return;

    // 新規ノードの作成
    if (condition.createNewNode) {
      setCustomNodes(prev => [...prev, {
        id: condition.createNewNode!.id,
        label: condition.createNewNode!.label,
        shape: 'rectangle',
      }]);
    }

    // エッジの追加
    setCustomEdges(prev => [...prev, {
      from: selectedSourceNode.id,
      to: condition.targetNodeId,
      label: condition.label,
      style: condition.style,
    }]);

    setIsDialogOpen(false);
    setSelectedSourceNode(null);
  }, [selectedSourceNode]);

  // ノード追加
  const addNode = () => {
    const newId = String.fromCharCode(65 + customNodes.length); // A, B, C...
    setCustomNodes([...customNodes, { id: newId, label: `Node ${newId}`, shape: 'rectangle' }]);
  };

  // ノード削除
  const removeNode = (index: number) => {
    const nodeId = customNodes[index].id;
    setCustomNodes(customNodes.filter((_, i) => i !== index));
    setCustomEdges(customEdges.filter(e => e.from !== nodeId && e.to !== nodeId));
  };

  // エッジ追加
  const addEdge = () => {
    if (customNodes.length >= 2) {
      setCustomEdges([...customEdges, { from: customNodes[0].id, to: customNodes[1].id, label: '', style: 'solid' }]);
    }
  };

  // エッジ削除
  const removeEdge = (index: number) => {
    setCustomEdges(customEdges.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flowchart Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            JavaScript Object から Mermaid フローチャートを生成 ・ ノードをクリックして条件を追加
          </p>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左パネル: コントロール */}
        <div className="w-1/3 p-4 overflow-y-auto border-r border-gray-200 bg-white">
          {/* 操作説明 */}
          <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>ヒント:</strong> フローチャートのノードをクリックすると、そのノードから新しい接続を追加できます。
            </p>
          </div>

          {/* ノードエディター */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">ノード</h3>
                <button
                  onClick={addNode}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  + 追加
                </button>
              </div>
              <div className="space-y-2">
                {customNodes.map((node, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                    <input
                      type="text"
                      value={node.id}
                      onChange={e => {
                        const newNodes = [...customNodes];
                        const oldId = newNodes[index].id;
                        newNodes[index].id = e.target.value;
                        setCustomNodes(newNodes);
                        // エッジのIDも更新
                        setCustomEdges(customEdges.map(edge => ({
                          ...edge,
                          from: edge.from === oldId ? e.target.value : edge.from,
                          to: edge.to === oldId ? e.target.value : edge.to,
                        })));
                      }}
                      className="w-12 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                      placeholder="ID"
                    />
                    <input
                      type="text"
                      value={node.label}
                      onChange={e => {
                        const newNodes = [...customNodes];
                        newNodes[index].label = e.target.value;
                        setCustomNodes(newNodes);
                      }}
                      className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                      placeholder="ラベル"
                    />
                    <select
                      value={node.shape}
                      onChange={e => {
                        const newNodes = [...customNodes];
                        newNodes[index].shape = e.target.value as NodeShape;
                        setCustomNodes(newNodes);
                      }}
                      className="px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {nodeShapes.map(shape => (
                        <option key={shape.value} value={shape.value}>
                          {shape.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeNode(index)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* エッジエディター */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">エッジ（接続）</h3>
                <button
                  onClick={addEdge}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  disabled={customNodes.length < 2}
                >
                  + 追加
                </button>
              </div>
              <div className="space-y-2">
                {customEdges.map((edge, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                    <select
                      value={edge.from}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].from = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {customNodes.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.id}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edge.style}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].style = e.target.value as EdgeStyle;
                        setCustomEdges(newEdges);
                      }}
                      className="px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {edgeStyles.map(style => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edge.to}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].to = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {customNodes.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.id}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={edge.label}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].label = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                      placeholder="ラベル（任意）"
                    />
                    <button
                      onClick={() => removeEdge(index)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Object定義表示 */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2 text-gray-900">FlowchartDefinition オブジェクト</h3>
            <pre className="p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-60 overflow-y-auto">
              {JSON.stringify(currentDefinition, null, 2)}
            </pre>
          </div>

          {/* 生成されたMermaidコード */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2 text-gray-900">生成された Mermaid コード</h3>
            <pre className="p-3 bg-gray-900 text-blue-300 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
              {mermaidCode}
            </pre>
          </div>
        </div>

        {/* 右パネル: プレビュー */}
        <div className="flex-1 p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">プレビュー（ノードをクリックして条件追加）</h2>
          <div className="bg-white rounded-lg shadow-sm h-[calc(100%-40px)]">
            <FlowchartRenderer
              mermaidCode={mermaidCode}
              onNodeClick={handleNodeClick}
            />
          </div>
        </div>
      </div>

      {/* 条件追加ダイアログ */}
      <AddConditionDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedSourceNode(null);
        }}
        sourceNode={selectedSourceNode}
        availableNodes={currentDefinition.nodes}
        onAddCondition={handleAddCondition}
      />
    </div>
  );
}
