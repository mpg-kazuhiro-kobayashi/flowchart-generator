'use client';

import { CustomNode, CustomEdge, EdgeStyle } from '@/types/flowchart';

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

interface EdgeListProps {
  edges: CustomEdge[];
  displayEdges: CustomEdge[];
  displayNodes: CustomNode[];
  onAddEdge: () => void;
  onUpdateEdge: (index: number, updates: Partial<CustomEdge>) => void;
  onRemoveEdge: (index: number) => void;
  nodesCount: number;
}

export default function EdgeList({
  edges,
  displayEdges,
  displayNodes,
  onAddEdge,
  onUpdateEdge,
  onRemoveEdge,
  nodesCount,
}: EdgeListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">エッジ（接続）</h3>
        <button
          onClick={onAddEdge}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
          disabled={nodesCount < 2}
        >
          + 追加
        </button>
      </div>
      <div className="space-y-2">
        {displayEdges.map((edge) => {
          const index = edges.findIndex(e => e.from === edge.from && e.to === edge.to && e.label === edge.label);
          return (
            <div key={`${edge.from}-${edge.to}-${index}`} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
              <select
                value={edge.from}
                onChange={e => onUpdateEdge(index, { from: e.target.value })}
                className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
              >
                {displayNodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </select>
              <select
                value={edge.style}
                onChange={e => onUpdateEdge(index, { style: e.target.value as EdgeStyle })}
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
                onChange={e => onUpdateEdge(index, { to: e.target.value })}
                className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
              >
                {displayNodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={edge.label}
                onChange={e => onUpdateEdge(index, { label: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                placeholder="ラベル（任意）"
              />
              <button
                onClick={() => onRemoveEdge(index)}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                削除
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
