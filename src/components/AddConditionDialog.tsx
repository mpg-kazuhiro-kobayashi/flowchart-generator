'use client';

import { useState, useEffect } from 'react';
import { FlowchartNode, EdgeStyle } from '@/types/flowchart';

interface AddConditionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: FlowchartNode | null;
  availableNodes: FlowchartNode[];
  onAddCondition: (condition: {
    targetNodeId: string;
    label: string;
    style: EdgeStyle;
    createNewNode?: {
      id: string;
      label: string;
    };
  }) => void;
}

const edgeStyleOptions: { value: EdgeStyle; label: string; description: string }[] = [
  { value: 'solid', label: '実線矢印', description: '-->' },
  { value: 'dotted', label: '点線矢印', description: '-.->' },
  { value: 'thick', label: '太線矢印', description: '==>' },
  { value: 'biDirectional', label: '双方向', description: '<-->' },
];

export default function AddConditionDialog({
  isOpen,
  onClose,
  sourceNode,
  availableNodes,
  onAddCondition,
}: AddConditionDialogProps) {
  const [targetType, setTargetType] = useState<'existing' | 'new'>('existing');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [conditionLabel, setConditionLabel] = useState('');
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('solid');

  // ダイアログが開いたときに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setTargetType('existing');
      setSelectedTargetId(availableNodes.length > 0 ? availableNodes[0].id : '');
      setNewNodeId('');
      setNewNodeLabel('');
      setConditionLabel('');
      setEdgeStyle('solid');
    }
  }, [isOpen, availableNodes]);

  // 利用可能なノード（ソースノード自身を除く）
  const selectableNodes = availableNodes.filter(n => n.id !== sourceNode?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (targetType === 'existing' && selectedTargetId) {
      onAddCondition({
        targetNodeId: selectedTargetId,
        label: conditionLabel,
        style: edgeStyle,
      });
    } else if (targetType === 'new' && newNodeId && newNodeLabel) {
      onAddCondition({
        targetNodeId: newNodeId,
        label: conditionLabel,
        style: edgeStyle,
        createNewNode: {
          id: newNodeId,
          label: newNodeLabel,
        },
      });
    }

    onClose();
  };

  const isValid = targetType === 'existing'
    ? !!selectedTargetId
    : !!(newNodeId && newNodeLabel);

  if (!isOpen || !sourceNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">条件を追加</h2>
          <p className="text-blue-100 text-sm mt-1">
            「{sourceNode.label}」からの接続を追加
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 接続先タイプの選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              接続先
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTargetType('existing')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  targetType === 'existing'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                既存のノード
              </button>
              <button
                type="button"
                onClick={() => setTargetType('new')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  targetType === 'new'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                新規ノード作成
              </button>
            </div>
          </div>

          {/* 既存ノード選択 */}
          {targetType === 'existing' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                接続先ノードを選択
              </label>
              {selectableNodes.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectableNodes.map(node => (
                    <label
                      key={node.id}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTargetId === node.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetNode"
                        value={node.id}
                        checked={selectedTargetId === node.id}
                        onChange={e => setSelectedTargetId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{node.label}</span>
                        <span className="text-gray-500 text-sm ml-2">({node.id})</span>
                      </div>
                      {selectedTargetId === node.id && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded-lg">
                  接続可能なノードがありません。新規ノードを作成してください。
                </p>
              )}
            </div>
          )}

          {/* 新規ノード作成 */}
          {targetType === 'new' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ノードID
                </label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={e => setNewNodeId(e.target.value)}
                  placeholder="例: node1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ノードラベル
                </label>
                <input
                  type="text"
                  value={newNodeLabel}
                  onChange={e => setNewNodeLabel(e.target.value)}
                  placeholder="例: 新しい処理"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>
          )}

          {/* 条件ラベル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              条件ラベル（任意）
            </label>
            <input
              type="text"
              value={conditionLabel}
              onChange={e => setConditionLabel(e.target.value)}
              placeholder="例: Yes, No, 成功時, エラー時"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            />
          </div>

          {/* エッジスタイル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              矢印のスタイル
            </label>
            <div className="grid grid-cols-2 gap-2">
              {edgeStyleOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                    edgeStyle === option.value
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="edgeStyle"
                    value={option.value}
                    checked={edgeStyle === option.value}
                    onChange={e => setEdgeStyle(e.target.value as EdgeStyle)}
                    className="sr-only"
                  />
                  <div>
                    <span className="font-medium text-gray-900 text-sm">{option.label}</span>
                    <span className="text-gray-400 text-xs ml-1">{option.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">プレビュー</p>
            <p className="font-mono text-sm text-gray-700">
              {sourceNode.id} {edgeStyleOptions.find(o => o.value === edgeStyle)?.description}
              {conditionLabel && `|${conditionLabel}|`}{' '}
              {targetType === 'existing' ? selectedTargetId : newNodeId || '???'}
            </p>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 py-2.5 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
