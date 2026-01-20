'use client';

import { useState, useEffect } from 'react';
import { EdgeStyle, NumericOperator, EdgeCondition, ChoiceOption, CompoundCondition, SingleCondition } from '@/types/flowchart';

// 数値演算子のオプション
const numericOperators: { value: NumericOperator; label: string; symbol: string }[] = [
  { value: 'eq', label: '等しい', symbol: '=' },
  { value: 'gt', label: 'より大きい', symbol: '>' },
  { value: 'lt', label: 'より小さい', symbol: '<' },
  { value: 'gte', label: '以上', symbol: '>=' },
  { value: 'lte', label: '以下', symbol: '<=' },
];

/** エッジ情報 */
export interface EdgeInfo {
  from: string;
  to: string;
  label: string;
  style: EdgeStyle;
  condition?: EdgeCondition;
  compoundCondition?: CompoundCondition;
}

/** ソースノード情報 */
export interface SourceNodeInfo {
  id: string;
  label: string;
  questionCategory?: 'SA' | 'MA' | 'NA' | 'FA';
  choices?: ChoiceOption[];
}

/** エッジ更新結果 */
export interface EdgeUpdateResult {
  label: string;
  style: EdgeStyle;
  condition?: EdgeCondition;
  compoundCondition?: CompoundCondition;
}

interface EdgeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 編集対象のエッジ */
  edge: EdgeInfo | null;
  /** ソースノードの情報（単一条件編集用） */
  sourceNode?: SourceNodeInfo;
  /** 複合条件に関連するノード情報 */
  conditionNodes?: SourceNodeInfo[];
  /** エッジ更新時のコールバック */
  onUpdateEdge: (update: EdgeUpdateResult) => void;
  /** エッジ削除時のコールバック */
  onDeleteEdge: () => void;
}

export default function EdgeEditDialog({
  isOpen,
  onClose,
  edge,
  sourceNode,
  conditionNodes = [],
  onUpdateEdge,
  onDeleteEdge,
}: EdgeEditDialogProps) {
  // エッジ編集用の状態
  const [edgeLabel, setEdgeLabel] = useState('');

  // 単一条件用の状態
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [numericOperator, setNumericOperator] = useState<NumericOperator>('eq');
  const [numericValue, setNumericValue] = useState<string>('');

  // 複合条件用の状態
  const [compoundConditions, setCompoundConditions] = useState<Map<string, SingleCondition>>(new Map());

  // 複合条件エッジかどうか
  const isCompoundConditionEdge = !!edge?.compoundCondition;

  // ダイアログが開いたときに状態を初期化
  useEffect(() => {
    if (isOpen && edge) {
      setEdgeLabel(edge.label);

      // 複合条件の場合
      if (edge.compoundCondition) {
        const condMap = new Map<string, SingleCondition>();
        edge.compoundCondition.conditions.forEach(cond => {
          condMap.set(cond.nodeId, cond);
        });
        setCompoundConditions(condMap);
      } else {
        setCompoundConditions(new Map());

        // 単一条件を復元
        if (edge.condition?.choiceIds) {
          setSelectedChoiceIds(edge.condition.choiceIds);
        } else {
          setSelectedChoiceIds([]);
        }

        if (edge.condition?.numericCondition) {
          setNumericOperator(edge.condition.numericCondition.operator);
          setNumericValue(edge.condition.numericCondition.value.toString());
        } else {
          setNumericOperator('eq');
          setNumericValue('');
        }
      }
    }
  }, [isOpen, edge]);

  // ソースノードの設問カテゴリに基づく判定（単一条件用）
  const hasChoices = !isCompoundConditionEdge &&
                     (sourceNode?.questionCategory === 'SA' || sourceNode?.questionCategory === 'MA') &&
                     sourceNode.choices && sourceNode.choices.length > 0;
  const isNumeric = !isCompoundConditionEdge && sourceNode?.questionCategory === 'NA';
  const isFreeAnswer = !isCompoundConditionEdge && sourceNode?.questionCategory === 'FA';

  // 複合条件を更新するヘルパー関数
  const updateCompoundCondition = (nodeId: string, condition: SingleCondition | null) => {
    const newConditions = new Map(compoundConditions);
    if (condition) {
      newConditions.set(nodeId, condition);
    } else {
      newConditions.delete(nodeId);
    }
    setCompoundConditions(newConditions);
  };

  // 条件ラベルを自動生成（単一条件用）
  const generateConditionLabel = (): string => {
    if (hasChoices && selectedChoiceIds.length > 0 && sourceNode?.choices) {
      const selectedLabels = sourceNode.choices
        .filter(c => selectedChoiceIds.includes(c.id))
        .map(c => c.label);
      return selectedLabels.join(', ');
    }
    if (isNumeric && numericValue) {
      const op = numericOperators.find(o => o.value === numericOperator);
      return `${op?.symbol || ''} ${numericValue}`;
    }
    return edgeLabel;
  };

  // 複合条件ラベルを生成
  const generateCompoundConditionLabel = (): string => {
    const parts: string[] = [];
    compoundConditions.forEach((cond, nodeId) => {
      const node = conditionNodes.find(n => n.id === nodeId);
      const nodeName = node?.label || nodeId;

      if (cond.conditionType === 'choice' && cond.choiceCondition) {
        const choiceLabels = cond.choiceCondition.choiceIds.map(choiceId => {
          const choice = node?.choices?.find(ch => ch.id === choiceId);
          return choice?.label || choiceId;
        });
        parts.push(`${nodeName}: ${choiceLabels.join(', ')}`);
      } else if (cond.conditionType === 'numeric' && cond.numericCondition) {
        const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[cond.numericCondition.operator];
        parts.push(`${nodeName} ${opSymbol} ${cond.numericCondition.value}`);
      }
    });
    return parts.join(' AND ');
  };

  // 保存処理
  const handleSave = () => {
    if (!edge) return;

    if (isCompoundConditionEdge) {
      // 複合条件の更新
      const conditions = Array.from(compoundConditions.values());
      const compoundCondition: CompoundCondition = {
        conditions,
        operator: 'AND',
      };
      const label = generateCompoundConditionLabel();
      onUpdateEdge({
        label,
        style: edge.style,
        compoundCondition,
      });
      onClose();
      return;
    }

    // 単一条件の更新
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

    const finalLabel = (hasChoices || isNumeric) ? generateConditionLabel() : edgeLabel;

    onUpdateEdge({
      label: finalLabel,
      style: edge.style,
      condition,
    });
    onClose();
  };

  // 削除処理
  const handleDelete = () => {
    if (confirm('このエッジを削除しますか？')) {
      onDeleteEdge();
      onClose();
    }
  };

  if (!isOpen || !edge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className={`px-6 py-4 ${isCompoundConditionEdge ? 'bg-gradient-to-r from-indigo-500 to-indigo-600' : 'bg-gradient-to-r from-purple-500 to-purple-600'}`}>
          <h2 className="text-xl font-bold text-white">
            {isCompoundConditionEdge ? '複合条件エッジ編集' : 'エッジ編集'}
          </h2>
          <p className="text-purple-100 text-sm mt-1">
            {edge.from} → {edge.to}
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 複合条件編集UI */}
          {isCompoundConditionEdge && conditionNodes.length > 0 && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800 font-medium">
                  複合条件（AND）
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  複数の設問の回答条件を組み合わせた分岐です
                </p>
              </div>

              {conditionNodes.map(node => {
                const currentCondition = compoundConditions.get(node.id);

                return (
                  <div
                    key={node.id}
                    className="p-3 rounded-lg border bg-gray-50 border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {node.label}
                        <span className="ml-2 text-xs text-gray-500">({node.questionCategory})</span>
                      </span>
                      {currentCondition && (
                        <button
                          type="button"
                          onClick={() => updateCompoundCondition(node.id, null)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          クリア
                        </button>
                      )}
                    </div>

                    {/* SA/MA の選択肢 */}
                    {(node.questionCategory === 'SA' || node.questionCategory === 'MA') && node.choices && (
                      <div className="flex flex-wrap gap-2">
                        {node.choices.map(choice => {
                          const isChoiceSelected = currentCondition?.choiceCondition?.choiceIds.includes(choice.id);
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => {
                                // SA/MA どちらも複数選択可能
                                const currentChoices = currentCondition?.choiceCondition?.choiceIds || [];
                                const newChoices = isChoiceSelected
                                  ? currentChoices.filter(id => id !== choice.id)
                                  : [...currentChoices, choice.id];
                                if (newChoices.length > 0) {
                                  updateCompoundCondition(node.id, {
                                    nodeId: node.id,
                                    conditionType: 'choice',
                                    choiceCondition: { choiceIds: newChoices },
                                  });
                                } else {
                                  updateCompoundCondition(node.id, null);
                                }
                              }}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isChoiceSelected
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* NA の数値条件 */}
                    {node.questionCategory === 'NA' && (
                      <div className="flex gap-2 items-center">
                        <select
                          value={currentCondition?.numericCondition?.operator || 'eq'}
                          onChange={e => {
                            const value = currentCondition?.numericCondition?.value;
                            if (value !== undefined) {
                              updateCompoundCondition(node.id, {
                                nodeId: node.id,
                                conditionType: 'numeric',
                                numericCondition: {
                                  operator: e.target.value as NumericOperator,
                                  value,
                                },
                              });
                            }
                          }}
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                        >
                          {numericOperators.map(op => (
                            <option key={op.value} value={op.value}>{op.symbol} {op.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={currentCondition?.numericCondition?.value ?? ''}
                          onChange={e => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            if (value !== undefined) {
                              updateCompoundCondition(node.id, {
                                nodeId: node.id,
                                conditionType: 'numeric',
                                numericCondition: {
                                  operator: currentCondition?.numericCondition?.operator || 'eq',
                                  value,
                                },
                              });
                            } else {
                              updateCompoundCondition(node.id, null);
                            }
                          }}
                          placeholder="値を入力"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 現在の条件プレビュー */}
              {compoundConditions.size > 0 && (
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">現在の条件:</p>
                  <p className="text-sm text-gray-900 font-medium">{generateCompoundConditionLabel()}</p>
                </div>
              )}
            </div>
          )}

          {/* 単一条件: ラベル */}
          {!isCompoundConditionEdge && !hasChoices && !isNumeric && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ラベル
              </label>
              <input
                type="text"
                value={edgeLabel}
                onChange={e => setEdgeLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                placeholder="エッジのラベル（任意）"
              />
            </div>
          )}

          {/* 単一条件: 選択肢による分岐条件（SA/MA） */}
          {hasChoices && sourceNode?.choices && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分岐条件（選択肢）
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                {sourceNode.choices.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      // SA/MA どちらも複数選択可能
                      if (selectedChoiceIds.includes(choice.id)) {
                        setSelectedChoiceIds(selectedChoiceIds.filter(id => id !== choice.id));
                      } else {
                        setSelectedChoiceIds([...selectedChoiceIds, choice.id]);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      selectedChoiceIds.includes(choice.id)
                        ? 'bg-purple-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                選択した条件: {selectedChoiceIds.length > 0 ? generateConditionLabel() : '未選択'}
              </p>
            </div>
          )}

          {/* 単一条件: 数値条件（NA） */}
          {isNumeric && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分岐条件（数値）
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
              {numericValue && (
                <p className="text-xs text-gray-500 mt-1">
                  条件: {generateConditionLabel()}
                </p>
              )}
            </div>
          )}

          {/* FA警告 */}
          {isFreeAnswer && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                自由入力（FA）の設問からのエッジには分岐条件を設定できません。
              </p>
            </div>
          )}

          {/* 削除ボタン */}
          <div className="pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              このエッジを削除
            </button>
          </div>
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isCompoundConditionEdge && compoundConditions.size < 2}
            className={`flex-1 py-2.5 px-4 text-white font-medium rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${
              isCompoundConditionEdge ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-purple-500 hover:bg-purple-600'
            }`}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
