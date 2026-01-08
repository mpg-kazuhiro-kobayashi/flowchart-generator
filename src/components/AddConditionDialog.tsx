'use client';

import { useState, useEffect } from 'react';
import { FlowchartNode, EdgeStyle, NumericOperator, EdgeCondition } from '@/types/flowchart';
import { validateNodeId } from '@/lib/validation';

// 数値演算子のオプション
const numericOperators: { value: NumericOperator; label: string; symbol: string }[] = [
  { value: 'eq', label: '等しい', symbol: '=' },
  { value: 'gt', label: 'より大きい', symbol: '>' },
  { value: 'lt', label: 'より小さい', symbol: '<' },
  { value: 'gte', label: '以上', symbol: '>=' },
  { value: 'lte', label: '以下', symbol: '<=' },
];

export interface AddConditionResult {
  targetNodeId: string;
  label: string;
  style: EdgeStyle;
  createNewNode?: {
    id: string;
    label: string;
  };
  condition?: EdgeCondition;
}

interface AddConditionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: FlowchartNode | null;
  availableNodes: FlowchartNode[];
  onAddCondition: (condition: AddConditionResult) => void;
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

  // 分岐条件用の状態
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [numericOperator, setNumericOperator] = useState<NumericOperator>('eq');
  const [numericValue, setNumericValue] = useState<string>('');

  // ダイアログが開いたときに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setTargetType('existing');
      setSelectedTargetId(availableNodes.length > 0 ? availableNodes[0].id : '');
      setNewNodeId('');
      setNewNodeLabel('');
      setConditionLabel('');
      setEdgeStyle('solid');
      setSelectedChoiceIds([]);
      setNumericOperator('eq');
      setNumericValue('');
    }
  }, [isOpen, availableNodes]);

  // 利用可能なノード（ソースノード自身を除く）
  const selectableNodes = availableNodes.filter(n => n.id !== sourceNode?.id);

  // ソースノードの設問カテゴリ
  const questionCategory = sourceNode?.questionCategory;
  const hasChoices = (questionCategory === 'SA' || questionCategory === 'MA') && sourceNode?.choices && sourceNode.choices.length > 0;
  const isNumeric = questionCategory === 'NA';
  const isFreeAnswer = questionCategory === 'FA';

  // 条件ラベルを自動生成
  const generateConditionLabel = (): string => {
    if (hasChoices && selectedChoiceIds.length > 0) {
      const selectedLabels = sourceNode!.choices!
        .filter(c => selectedChoiceIds.includes(c.id))
        .map(c => c.label);
      return selectedLabels.join(', ');
    }
    if (isNumeric && numericValue) {
      const op = numericOperators.find(o => o.value === numericOperator);
      return `${op?.symbol || ''} ${numericValue}`;
    }
    return conditionLabel;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 分岐条件を構築
    let condition: EdgeCondition | undefined;
    if (hasChoices && selectedChoiceIds.length > 0) {
      condition = { choiceIds: selectedChoiceIds };
    } else if (isNumeric && numericValue) {
      condition = {
        numericCondition: {
          operator: numericOperator,
          value: parseFloat(numericValue),
        },
      };
    }

    // 表示用ラベルを決定
    const finalLabel = generateConditionLabel();

    if (targetType === 'existing' && selectedTargetId) {
      onAddCondition({
        targetNodeId: selectedTargetId,
        label: finalLabel,
        style: edgeStyle,
        condition,
      });
    } else if (targetType === 'new' && newNodeId && newNodeLabel) {
      onAddCondition({
        targetNodeId: newNodeId,
        label: finalLabel,
        style: edgeStyle,
        createNewNode: {
          id: newNodeId,
          label: newNodeLabel,
        },
        condition,
      });
    }

    onClose();
  };

  // バリデーション
  const isTargetValid = targetType === 'existing'
    ? !!selectedTargetId
    : !!(newNodeId && newNodeLabel && validateNodeId(newNodeId).valid);

  // 分岐条件のバリデーション（設問カテゴリがある場合のみ必須）
  const isConditionValid = (() => {
    if (!questionCategory) return true; // 設問なしの場合は条件不要
    if (isFreeAnswer) return false; // FAは分岐不可
    if (hasChoices) return selectedChoiceIds.length > 0;
    if (isNumeric) return numericValue !== '';
    return true;
  })();

  const isValid = isTargetValid && isConditionValid;

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
          {targetType === 'new' && (() => {
            const idValidation = validateNodeId(newNodeId);
            return (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ノードID
                </label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={e => setNewNodeId(e.target.value)}
                  placeholder="例: Node1"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 ${
                    newNodeId && !idValidation.valid ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {newNodeId && !idValidation.valid && (
                  <p className="mt-1 text-xs text-red-600">{idValidation.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">英字で始まり、英数字とアンダースコアのみ使用可能</p>
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
            );
          })()}

          {/* 自由入力の警告（FAの場合） */}
          {isFreeAnswer && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>注意:</strong> 自由入力（FA）の設問は分岐条件を設定できません。
              </p>
            </div>
          )}

          {/* 選択肢による分岐条件（SA/MAの場合） */}
          {hasChoices && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分岐条件: 選択肢を選択
                {questionCategory === 'SA' && <span className="text-gray-500 text-xs ml-2">（1つ選択）</span>}
                {questionCategory === 'MA' && <span className="text-gray-500 text-xs ml-2">（複数選択可）</span>}
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                {sourceNode!.choices!.map(choice => (
                  <label
                    key={choice.id}
                    className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                      selectedChoiceIds.includes(choice.id)
                        ? 'bg-green-100 border border-green-400'
                        : 'bg-white border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type={questionCategory === 'SA' ? 'radio' : 'checkbox'}
                      name="choiceCondition"
                      value={choice.id}
                      checked={selectedChoiceIds.includes(choice.id)}
                      onChange={e => {
                        if (questionCategory === 'SA') {
                          // 単一選択の場合
                          setSelectedChoiceIds([e.target.value]);
                        } else {
                          // 複数選択の場合
                          if (e.target.checked) {
                            setSelectedChoiceIds([...selectedChoiceIds, e.target.value]);
                          } else {
                            setSelectedChoiceIds(selectedChoiceIds.filter(id => id !== e.target.value));
                          }
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900">{choice.label}</span>
                    <span className="text-xs text-gray-500 ml-2">({choice.id})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 数値条件（NAの場合） */}
          {isNumeric && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分岐条件: 数値条件を設定
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={numericOperator}
                  onChange={e => setNumericOperator(e.target.value as NumericOperator)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  {numericOperators.map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label} ({op.symbol})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={numericValue}
                  onChange={e => setNumericValue(e.target.value)}
                  placeholder="値を入力"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>
          )}

          {/* 条件ラベル（設問カテゴリがない場合のみ表示） */}
          {!questionCategory && (
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
          )}

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
              {generateConditionLabel() && `|${generateConditionLabel()}|`}{' '}
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
