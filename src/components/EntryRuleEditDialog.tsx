"use client";

import { FlowchartNode, FlowchartEdge, NodeEntryRule } from "@/types/flowchart";
import EntryRuleEditor from "./EntryRuleEditor";

interface EntryRuleEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 編集対象のノードID */
  targetNodeId: string;
  /** 編集対象のノードラベル */
  targetNodeLabel: string;
  /** 編集対象のルール */
  rule: NodeEntryRule;
  /** 選択可能なノード一覧 */
  availableNodes: FlowchartNode[];
  /** 全ノード一覧（経路解析用） */
  allNodes: FlowchartNode[];
  /** 全エッジ一覧（経路解析用） */
  allEdges: FlowchartEdge[];
  /** ルール更新コールバック */
  onUpdateRule: (nodeId: string, ruleId: string, updates: Partial<NodeEntryRule>) => void;
  /** ルール削除コールバック */
  onDeleteRule: (nodeId: string, ruleId: string) => void;
}

export default function EntryRuleEditDialog({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  rule,
  availableNodes,
  allNodes,
  allEdges,
  onUpdateRule,
  onDeleteRule,
}: EntryRuleEditDialogProps) {
  if (!isOpen) return null;

  const sourceNodeInfo = availableNodes.find((n) => n.id === rule.sourceNodeId);

  const handleSave = (updatedRule: Omit<NodeEntryRule, "id">) => {
    onUpdateRule(targetNodeId, rule.id, updatedRule);
    onClose();
  };

  const handleDelete = () => {
    if (confirm("この到達ルールを削除しますか？")) {
      onDeleteRule(targetNodeId, rule.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">到達ルールを編集</h2>
          <p className="text-yellow-100 text-sm mt-1">
            {sourceNodeInfo?.label || rule.sourceNodeId} → 「{targetNodeLabel}」
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          <EntryRuleEditor
            mode="edit"
            initialRule={rule}
            targetNodeId={targetNodeId}
            availableNodes={availableNodes}
            allNodes={allNodes}
            allEdges={allEdges}
            onSave={handleSave}
            onCancel={onClose}
          />

          {/* 削除ボタン */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              この到達ルールを削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
