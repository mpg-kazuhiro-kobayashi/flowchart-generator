'use client';

import { CustomNode, FlowchartEdge } from '@/types/flowchart';

interface EdgeListProps {
  edges: FlowchartEdge[];
  nodes: CustomNode[];
  onAddEdge: () => void;
  onUpdateEdge: (index: number, updates: Partial<FlowchartEdge>) => void;
  onRemoveEdge: (index: number) => void;
}

export default function EdgeList({
  edges,
  nodes,
  onAddEdge,
  onUpdateEdge,
  onRemoveEdge,
}: EdgeListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">エッジ（接続）</h3>
        <button
          onClick={onAddEdge}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
          disabled={nodes.length < 2}
        >
          + 追加
        </button>
      </div>
      <div className="space-y-2">
        {edges.map((edge, index) => (
          <div key={`${edge.from}-${edge.to}-${index}`} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
            <select
              value={edge.from}
              onChange={e => onUpdateEdge(index, { from: e.target.value })}
              className="w-20 px-2 py-1 text-xs border rounded bg-white text-gray-900"
            >
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.id}
                </option>
              ))}
            </select>
            <span className="text-gray-500">→</span>
            <select
              value={edge.to}
              onChange={e => onUpdateEdge(index, { to: e.target.value })}
              className="w-20 px-2 py-1 text-xs border rounded bg-white text-gray-900"
            >
              {nodes.map(node => (
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
        ))}
      </div>
    </div>
  );
}
