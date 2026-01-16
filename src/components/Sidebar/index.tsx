'use client';

import { CustomNode, CustomEdge, FlowchartDefinition } from '@/types/flowchart';
import { CoverageResult } from '@/domain/coverage';
import NodeList from './NodeList';
import EdgeList from './EdgeList';

interface SidebarProps {
  // ノード関連
  nodes: CustomNode[];
  displayNodes: CustomNode[];
  coverageMap: Map<string, CoverageResult>;
  editingChoicesIndex: number | null;
  onAddNode: () => void;
  onUpdateNode: (index: number, updates: Partial<CustomNode>) => void;
  onRemoveNode: (index: number) => void;
  onToggleChoicesEdit: (index: number) => void;
  onAddChoice: (nodeIndex: number) => void;
  onRemoveChoice: (nodeIndex: number, choiceIndex: number) => void;
  onUpdateChoice: (nodeIndex: number, choiceIndex: number, field: 'label', value: string) => void;
  // エッジ関連
  edges: CustomEdge[];
  displayEdges: CustomEdge[];
  onAddEdge: () => void;
  onUpdateEdge: (index: number, updates: Partial<CustomEdge>) => void;
  onRemoveEdge: (index: number) => void;
  // デバッグ表示
  currentDefinition: FlowchartDefinition;
  mermaidCode: string;
}

export default function Sidebar({
  nodes,
  displayNodes,
  coverageMap,
  editingChoicesIndex,
  onAddNode,
  onUpdateNode,
  onRemoveNode,
  onToggleChoicesEdit,
  onAddChoice,
  onRemoveChoice,
  onUpdateChoice,
  edges,
  displayEdges,
  onAddEdge,
  onUpdateEdge,
  onRemoveEdge,
  currentDefinition,
  mermaidCode,
}: SidebarProps) {
  return (
    <div className="w-1/3 p-4 overflow-y-auto border-r border-gray-200 bg-white">
      {/* 操作説明 */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>ヒント:</strong> フローチャートのノードをクリックすると、そのノードから新しい接続を追加できます。
        </p>
      </div>

      {/* ノードエディター */}
      <div className="space-y-6">
        <NodeList
          nodes={nodes}
          displayNodes={displayNodes}
          coverageMap={coverageMap}
          editingChoicesIndex={editingChoicesIndex}
          onAddNode={onAddNode}
          onUpdateNode={onUpdateNode}
          onRemoveNode={onRemoveNode}
          onToggleChoicesEdit={onToggleChoicesEdit}
          onAddChoice={onAddChoice}
          onRemoveChoice={onRemoveChoice}
          onUpdateChoice={onUpdateChoice}
        />

        {/* エッジエディター */}
        <EdgeList
          edges={edges}
          displayEdges={displayEdges}
          displayNodes={displayNodes}
          onAddEdge={onAddEdge}
          onUpdateEdge={onUpdateEdge}
          onRemoveEdge={onRemoveEdge}
          nodesCount={nodes.length}
        />
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
  );
}
