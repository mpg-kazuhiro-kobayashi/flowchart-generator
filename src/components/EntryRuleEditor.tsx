'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FlowchartNode,
  FlowchartEdge,
  EdgeStyle,
  NumericOperator,
  ChoiceOption,
  QuestionCategory,
  NodeEntryRule,
  NodeVisibilityCondition,
  SingleCondition,
} from '@/types/flowchart';
import { getReachableQuestionNodes } from '@/domain/graphAnalysis';

// 数値演算子のオプション
const numericOperators: { value: NumericOperator; label: string; symbol: string }[] = [
  { value: 'eq', label: '等しい', symbol: '=' },
  { value: 'gt', label: 'より大きい', symbol: '>' },
  { value: 'lt', label: 'より小さい', symbol: '<' },
  { value: 'gte', label: '以上', symbol: '>=' },
  { value: 'lte', label: '以下', symbol: '<=' },
];

/** 複合条件用のノード定義 */
export interface ConditionNode {
  id: string;
  label: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

type ConditionType = 'always' | 'choice' | 'numeric' | 'compound' | 'default';

export interface EntryRuleEditorProps {
  /** 編集モード */
  mode: 'add' | 'edit';
  /** 編集対象のルール（mode='edit' 時は必須） */
  initialRule?: NodeEntryRule;
  /** 対象ノードのID（選択肢から除外するため） */
  targetNodeId: string;
  /** 選択可能なノード一覧 */
  availableNodes: FlowchartNode[];
  /** 全ノード一覧（経路解析用） */
  allNodes: FlowchartNode[];
  /** 全エッジ一覧（経路解析用） */
  allEdges: FlowchartEdge[];
  /** 保存コールバック */
  onSave: (rule: Omit<NodeEntryRule, 'id'>) => void;
  /** キャンセルコールバック */
  onCancel: () => void;
}

export default function EntryRuleEditor({
  mode,
  initialRule,
  targetNodeId,
  availableNodes,
  allNodes,
  allEdges,
  onSave,
  onCancel,
}: EntryRuleEditorProps) {
  // 状態
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [conditionType, setConditionType] = useState<ConditionType>('always');
  const [style, setStyle] = useState<EdgeStyle>('solid');
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [numericOperator, setNumericOperator] = useState<NumericOperator>('eq');
  const [numericValue, setNumericValue] = useState<string>('');
  const [compoundConditions, setCompoundConditions] = useState<Map<string, SingleCondition>>(new Map());

  // 選択可能なノード（対象ノード自身を除く）
  const selectableNodes = useMemo(
    () => availableNodes.filter(n => n.id !== targetNodeId),
    [availableNodes, targetNodeId]
  );

  // 初期値を設定
  useEffect(() => {
    if (mode === 'edit' && initialRule) {
      setSourceNodeId(initialRule.sourceNodeId);
      setStyle(initialRule.style || 'solid');

      const condition = initialRule.visibilityCondition;
      if (!condition || condition.type === 'always') {
        setConditionType('always');
        setSelectedChoiceIds([]);
        setNumericOperator('eq');
        setNumericValue('');
        setCompoundConditions(new Map());
      } else if (condition.type === 'default') {
        setConditionType('default');
        setSelectedChoiceIds([]);
        setNumericOperator('eq');
        setNumericValue('');
        setCompoundConditions(new Map());
      } else if (condition.type === 'choice') {
        setConditionType('choice');
        setSelectedChoiceIds(condition.choiceIds);
        setNumericOperator('eq');
        setNumericValue('');
        setCompoundConditions(new Map());
      } else if (condition.type === 'numeric') {
        setConditionType('numeric');
        setSelectedChoiceIds([]);
        setNumericOperator(condition.numeric.operator);
        setNumericValue(String(condition.numeric.value));
        setCompoundConditions(new Map());
      } else if (condition.type === 'compound') {
        setConditionType('compound');
        setSelectedChoiceIds([]);
        setNumericOperator('eq');
        setNumericValue('');
        const compoundMap = new Map<string, SingleCondition>();
        for (const cond of condition.compound.conditions) {
          compoundMap.set(cond.nodeId, cond);
        }
        setCompoundConditions(compoundMap);
      }
    } else {
      // 新規追加モード
      setSourceNodeId(selectableNodes.length > 0 ? selectableNodes[0].id : '');
      setConditionType('always');
      setStyle('solid');
      setSelectedChoiceIds([]);
      setNumericOperator('eq');
      setNumericValue('');
      setCompoundConditions(new Map());
    }
  }, [mode, initialRule, selectableNodes]);

  // 選択されたソースノードの情報
  // 接続元ノードの情報は availableNodes から取得（選択肢・数値条件の判定用）
  const selectedSourceNode = availableNodes.find(n => n.id === sourceNodeId);
  const sourceHasChoices = selectedSourceNode?.choices && selectedSourceNode.choices.length > 0;
  const sourceIsNumeric = selectedSourceNode?.questionCategory === 'NA';

  // 選択中のソースノードから既にデフォルトエッジが出ているかをチェック
  // 編集モードの場合は、自分自身のルールは除外する
  const hasExistingDefaultEdge = useMemo(() => {
    if (!sourceNodeId) return false;
    for (const node of allNodes) {
      if (!node.entryRules) continue;
      for (const rule of node.entryRules) {
        // 編集モードの場合、自分自身のルールは除外
        if (mode === 'edit' && initialRule && rule.id === initialRule.id) continue;
        if (rule.sourceNodeId === sourceNodeId && rule.visibilityCondition?.type === 'default') {
          return true;
        }
      }
    }
    return false;
  }, [sourceNodeId, allNodes, mode, initialRule]);

  // ソースノード変更時に、既にデフォルトエッジがある場合は条件タイプをリセット
  useEffect(() => {
    if (hasExistingDefaultEdge && conditionType === 'default') {
      setConditionType('always');
    }
  }, [hasExistingDefaultEdge, conditionType]);

  // 複合条件に使用できるノード（接続元ノードから逆方向に辿れる設問ノード + 接続元ノード自身）
  // sourceNodeId が変更されるたびに再計算
  const conditionNodes = useMemo((): ConditionNode[] => {
    if (!sourceNodeId) return [];

    // 接続元ノードから逆方向に辿れる設問ノードを取得
    const reachableNodes = getReachableQuestionNodes(sourceNodeId, allNodes, allEdges);

    // 接続元ノード自身が設問ノードの場合は追加
    const sourceNode = allNodes.find(n => n.id === sourceNodeId);
    if (sourceNode && sourceNode.questionCategory && sourceNode.questionCategory !== 'FA') {
      // 既に含まれていない場合のみ追加
      const alreadyIncluded = reachableNodes.some(n => n.id === sourceNodeId);
      if (!alreadyIncluded) {
        reachableNodes.push(sourceNode);
      }
    }

    return reachableNodes.map(node => ({
      id: node.id,
      label: node.label,
      questionCategory: node.questionCategory,
      choices: node.choices,
    }));
  }, [sourceNodeId, allNodes, allEdges]);

  // 複合条件を更新
  const updateCompoundCondition = (nodeId: string, condition: SingleCondition | null) => {
    const newConditions = new Map(compoundConditions);
    if (condition) {
      newConditions.set(nodeId, condition);
    } else {
      newConditions.delete(nodeId);
    }
    setCompoundConditions(newConditions);
  };

  // バリデーション
  const isValid = useMemo(() => {
    if (!sourceNodeId) return false;
    switch (conditionType) {
      case 'always':
      case 'default':
        return true;
      case 'choice':
        return selectedChoiceIds.length > 0;
      case 'numeric':
        return numericValue !== '';
      case 'compound':
        return compoundConditions.size >= 1;
      default:
        return false;
    }
  }, [sourceNodeId, conditionType, selectedChoiceIds, numericValue, compoundConditions]);

  // 保存処理
  const handleSave = () => {
    if (!sourceNodeId) return;

    let visibilityCondition: NodeVisibilityCondition | undefined;

    switch (conditionType) {
      case 'always':
        visibilityCondition = { type: 'always' };
        break;
      case 'default':
        visibilityCondition = { type: 'default' };
        break;
      case 'choice':
        if (selectedChoiceIds.length > 0) {
          visibilityCondition = { type: 'choice', choiceIds: selectedChoiceIds };
        }
        break;
      case 'numeric':
        if (numericValue) {
          visibilityCondition = {
            type: 'numeric',
            numeric: {
              operator: numericOperator,
              value: parseFloat(numericValue),
            },
          };
        }
        break;
      case 'compound':
        if (compoundConditions.size >= 1) {
          const conditions = Array.from(compoundConditions.values());
          visibilityCondition = {
            type: 'compound',
            compound: {
              conditions,
              operator: 'AND',
            },
          };
        }
        break;
    }

    const rule: Omit<NodeEntryRule, 'id'> = {
      sourceNodeId,
      style,
      visibilityCondition,
    };

    onSave(rule);
  };

  // スタイル設定（mode に応じて色を変える）
  const containerBgClass = mode === 'add' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-400';
  const headerTextClass = mode === 'add' ? 'text-green-800' : 'text-yellow-800';
  const buttonBgClass = mode === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600';
  const selectedChoiceBgClass = mode === 'add' ? 'bg-green-500' : 'bg-yellow-500';

  return (
    <div className={`p-4 rounded-lg border-2 space-y-3 ${containerBgClass}`}>
      <div className="flex items-center justify-between">
        <h4 className={`font-medium ${headerTextClass}`}>
          {mode === 'add' ? '新しい到達ルールを追加' : 'ルールを編集中'}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* ソースノード選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          接続元ノード
        </label>
        <select
          value={sourceNodeId}
          onChange={e => {
            setSourceNodeId(e.target.value);
            setSelectedChoiceIds([]);
            setNumericValue('');
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
        >
          {selectableNodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.label} ({node.id})
            </option>
          ))}
        </select>
      </div>

      {/* 条件タイプ選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          条件タイプ
        </label>
        <select
          value={conditionType}
          onChange={e => setConditionType(e.target.value as ConditionType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
        >
          <option value="always">無条件</option>
          {sourceHasChoices && <option value="choice">選択肢条件</option>}
          {sourceIsNumeric && <option value="numeric">数値条件</option>}
          {/* 複合条件は経路上に2つ以上の設問ノードがある場合のみ表示 */}
          {conditionNodes.length >= 2 && <option value="compound">複合条件</option>}
          {/* デフォルトエッジは同一ソースノードから1つのみ許可 */}
          {!hasExistingDefaultEdge && <option value="default">条件なし</option>}
        </select>
        {hasExistingDefaultEdge && conditionType !== 'default' && (
          <p className="text-xs text-gray-500 mt-1">
            ※ このノードには既にデフォルトエッジが設定されています
          </p>
        )}
      </div>

      {/* 選択肢条件 */}
      {conditionType === 'choice' && selectedSourceNode?.choices && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            選択肢（複数選択可）
          </label>
          <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-gray-200">
            {selectedSourceNode.choices.map(choice => (
              <button
                key={choice.id}
                type="button"
                onClick={() => {
                  if (selectedChoiceIds.includes(choice.id)) {
                    setSelectedChoiceIds(selectedChoiceIds.filter(id => id !== choice.id));
                  } else {
                    setSelectedChoiceIds([...selectedChoiceIds, choice.id]);
                  }
                }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedChoiceIds.includes(choice.id)
                    ? `${selectedChoiceBgClass} text-white`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 数値条件 */}
      {conditionType === 'numeric' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            数値条件
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
        </div>
      )}

      {/* 複合条件 */}
      {conditionType === 'compound' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            複合条件設定（AND条件）
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {conditionNodes.map(node => {
              const currentCondition = compoundConditions.get(node.id);
              const isSelected = !!currentCondition;

              return (
                <div
                  key={node.id}
                  className={`p-2 rounded-lg border ${
                    isSelected ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 text-xs">
                      {node.label} ({node.questionCategory})
                    </span>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => updateCompoundCondition(node.id, null)}
                        className="text-xs text-red-600"
                      >
                        クリア
                      </button>
                    )}
                  </div>

                  {(node.questionCategory === 'SA' || node.questionCategory === 'MA') && node.choices && (
                    <div className="flex flex-wrap gap-1">
                      {node.choices.map(choice => {
                        const isChoiceSelected = currentCondition?.choiceCondition?.choiceIds.includes(choice.id);
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => {
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
                            className={`px-2 py-0.5 text-xs rounded ${
                              isChoiceSelected
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}
                          >
                            {choice.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {node.questionCategory === 'NA' && (
                    <div className="flex gap-1 items-center">
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
                        className="px-1 py-0.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {numericOperators.map(op => (
                          <option key={op.value} value={op.value}>{op.symbol}</option>
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
                        placeholder="値"
                        className="flex-1 px-1 py-0.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 保存・キャンセルボタン */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className={`flex-1 py-2 px-4 text-white font-medium rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${buttonBgClass}`}
        >
          {mode === 'add' ? '追加' : '保存'}
        </button>
      </div>
    </div>
  );
}
