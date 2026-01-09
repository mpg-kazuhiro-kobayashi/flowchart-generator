'use client';

import { useState, useEffect } from 'react';
import { FlowchartNode, EdgeStyle, NumericOperator, EdgeCondition, CompoundCondition, SingleCondition, ChoiceOption, QuestionCategory } from '@/types/flowchart';
import { validateNodeId } from '@/lib/validation';

// 数値演算子のオプション
const numericOperators: { value: NumericOperator; label: string; symbol: string }[] = [
  { value: 'eq', label: '等しい', symbol: '=' },
  { value: 'gt', label: 'より大きい', symbol: '>' },
  { value: 'lt', label: 'より小さい', symbol: '<' },
  { value: 'gte', label: '以上', symbol: '>=' },
  { value: 'lte', label: '以下', symbol: '<=' },
];

// 設問カテゴリオプション
const questionCategories: { value: QuestionCategory | ''; label: string; description: string }[] = [
  { value: '', label: '設問なし', description: '通常のノード' },
  { value: 'SA', label: 'SA（単一選択）', description: '選択肢から1つ選択' },
  { value: 'MA', label: 'MA（複数選択）', description: '選択肢から複数選択' },
  { value: 'FA', label: 'FA（自由入力）', description: 'テキスト入力（分岐不可）' },
  { value: 'NA', label: 'NA（数値入力）', description: '数値入力（条件分岐可能）' },
];

/** 複合条件用のノード定義（questionCategory と choices を含む） */
interface ConditionNode extends FlowchartNode {
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

/** 接続追加の結果 */
export interface AddConditionResult {
  targetNodeId: string;
  label: string;
  style: EdgeStyle;
  createNewNode?: {
    id: string;
    label: string;
  };
  condition?: EdgeCondition;
  compoundCondition?: CompoundCondition;
}

/** ノード更新の結果 */
export interface NodeUpdateResult {
  label: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

interface NodeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: (FlowchartNode & { questionCategory?: QuestionCategory; choices?: ChoiceOption[] }) | null;
  availableNodes: FlowchartNode[];
  conditionNodes?: ConditionNode[];
  onAddCondition: (condition: AddConditionResult) => void;
  onUpdateNode: (nodeId: string, update: NodeUpdateResult) => void;
}

const edgeStyleOptions: { value: EdgeStyle; label: string; description: string }[] = [
  { value: 'solid', label: '実線矢印', description: '-->' },
  { value: 'dotted', label: '点線矢印', description: '-.->' },
  { value: 'thick', label: '太線矢印', description: '==>' },
  { value: 'biDirectional', label: '双方向', description: '<-->' },
];

type TabType = 'settings' | 'connection';

export default function NodeEditDialog({
  isOpen,
  onClose,
  sourceNode,
  availableNodes,
  conditionNodes = [],
  onAddCondition,
  onUpdateNode,
}: NodeEditDialogProps) {
  // タブ状態
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  // ノード設定用の状態
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeQuestionCategory, setNodeQuestionCategory] = useState<QuestionCategory | ''>('');
  const [nodeChoices, setNodeChoices] = useState<ChoiceOption[]>([]);

  // 接続追加用の状態
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

  // 複合条件用の状態
  const [useCompoundCondition, setUseCompoundCondition] = useState(false);
  const [compoundConditions, setCompoundConditions] = useState<Map<string, SingleCondition>>(new Map());

  // ダイアログが開いたときに状態をリセット
  useEffect(() => {
    if (isOpen && sourceNode) {
      // ノード設定を初期化
      setNodeLabel(sourceNode.label);
      setNodeQuestionCategory(sourceNode.questionCategory || '');
      setNodeChoices(sourceNode.choices ? [...sourceNode.choices] : []);

      // 接続追加を初期化
      setTargetType('existing');
      setSelectedTargetId(availableNodes.length > 0 ? availableNodes[0].id : '');
      setNewNodeId('');
      setNewNodeLabel('');
      setConditionLabel('');
      setEdgeStyle('solid');
      setSelectedChoiceIds([]);
      setNumericOperator('eq');
      setNumericValue('');
      setUseCompoundCondition(false);
      setCompoundConditions(new Map());

      // デフォルトタブ
      setActiveTab('settings');
    }
  }, [isOpen, sourceNode, availableNodes]);

  // 利用可能なノード（ソースノード自身を除く）
  const selectableNodes = availableNodes.filter(n => n.id !== sourceNode?.id);

  // 現在のノード設定での設問カテゴリ判定
  const currentQuestionCategory = nodeQuestionCategory as QuestionCategory | undefined;
  const currentHasChoices = (currentQuestionCategory === 'SA' || currentQuestionCategory === 'MA') && nodeChoices.length > 0;
  const currentIsNumeric = currentQuestionCategory === 'NA';
  const currentIsFreeAnswer = currentQuestionCategory === 'FA';

  // 条件ラベルを自動生成
  const generateConditionLabel = (): string => {
    if (currentHasChoices && selectedChoiceIds.length > 0) {
      const selectedLabels = nodeChoices
        .filter(c => selectedChoiceIds.includes(c.id))
        .map(c => c.label);
      return selectedLabels.join(', ');
    }
    if (currentIsNumeric && numericValue) {
      const op = numericOperators.find(o => o.value === numericOperator);
      return `${op?.symbol || ''} ${numericValue}`;
    }
    return conditionLabel;
  };

  // 選択肢追加
  const addChoice = () => {
    const newId = `${sourceNode?.id}_opt${nodeChoices.length + 1}`;
    setNodeChoices([...nodeChoices, { id: newId, label: `選択肢${nodeChoices.length + 1}` }]);
  };

  // 選択肢削除
  const removeChoice = (index: number) => {
    setNodeChoices(nodeChoices.filter((_, i) => i !== index));
  };

  // 選択肢更新
  const updateChoice = (index: number, field: 'id' | 'label', value: string) => {
    const newChoices = [...nodeChoices];
    newChoices[index][field] = value;
    setNodeChoices(newChoices);
  };

  // ノード設定を保存
  const handleSaveSettings = () => {
    if (!sourceNode) return;

    const update: NodeUpdateResult = {
      label: nodeLabel,
    };

    if (nodeQuestionCategory) {
      update.questionCategory = nodeQuestionCategory as QuestionCategory;
      if (nodeQuestionCategory === 'SA' || nodeQuestionCategory === 'MA') {
        update.choices = nodeChoices;
      }
    }

    onUpdateNode(sourceNode.id, update);
    onClose();
  };

  // 接続追加を実行
  const handleAddConnection = (e: React.FormEvent) => {
    e.preventDefault();

    // 複合条件の場合
    if (useCompoundCondition && compoundConditions.size >= 2) {
      const conditions = Array.from(compoundConditions.values());
      const compoundCondition: CompoundCondition = {
        conditions,
        operator: 'AND',
      };

      const targetNodeId = targetType === 'existing' ? selectedTargetId : newNodeId;
      const result: AddConditionResult = {
        targetNodeId,
        label: conditionLabel,
        style: edgeStyle,
        compoundCondition,
      };

      if (targetType === 'new' && newNodeId && newNodeLabel) {
        result.createNewNode = {
          id: newNodeId,
          label: newNodeLabel,
        };
      }

      onAddCondition(result);
      onClose();
      return;
    }

    // 単一条件の場合
    let condition: EdgeCondition | undefined;
    if (currentHasChoices && selectedChoiceIds.length > 0) {
      condition = { choiceIds: selectedChoiceIds };
    } else if (currentIsNumeric && numericValue) {
      condition = {
        numericCondition: {
          operator: numericOperator,
          value: parseFloat(numericValue),
        },
      };
    }

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

  // バリデーション
  const isTargetValid = targetType === 'existing'
    ? !!selectedTargetId
    : !!(newNodeId && newNodeLabel && validateNodeId(newNodeId).valid);

  const isConditionValid = (() => {
    if (useCompoundCondition) {
      return compoundConditions.size >= 2;
    }
    if (!currentQuestionCategory) return true;
    if (currentIsFreeAnswer) return false;
    if (currentHasChoices) return selectedChoiceIds.length > 0;
    if (currentIsNumeric) return numericValue !== '';
    return true;
  })();

  const isConnectionValid = isTargetValid && isConditionValid;
  const isSettingsValid = nodeLabel.trim() !== '';

  if (!isOpen || !sourceNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">ノード設定</h2>
          <p className="text-blue-100 text-sm mt-1">
            「{sourceNode.label}」({sourceNode.id})
          </p>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            設問設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'connection'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            接続追加
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 設問設定タブ */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* ラベル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ノードラベル
                </label>
                <input
                  type="text"
                  value={nodeLabel}
                  onChange={e => setNodeLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>

              {/* 設問タイプ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  設問タイプ
                </label>
                <div className="space-y-2">
                  {questionCategories.map(cat => (
                    <label
                      key={cat.value}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        nodeQuestionCategory === cat.value
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="questionCategory"
                        value={cat.value}
                        checked={nodeQuestionCategory === cat.value}
                        onChange={e => {
                          const value = e.target.value as QuestionCategory | '';
                          setNodeQuestionCategory(value);
                          // SA/MAに変更時、選択肢がなければ初期化
                          if ((value === 'SA' || value === 'MA') && nodeChoices.length === 0) {
                            setNodeChoices([]);
                          }
                        }}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{cat.label}</span>
                        <p className="text-gray-500 text-xs mt-0.5">{cat.description}</p>
                      </div>
                      {nodeQuestionCategory === cat.value && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* 選択肢編集（SA/MAの場合） */}
              {(nodeQuestionCategory === 'SA' || nodeQuestionCategory === 'MA') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      選択肢
                    </label>
                    <button
                      type="button"
                      onClick={addChoice}
                      className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      + 選択肢を追加
                    </button>
                  </div>
                  {nodeChoices.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                      {nodeChoices.map((choice, index) => (
                        <div key={index} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200">
                          <input
                            type="text"
                            value={choice.id}
                            onChange={e => updateChoice(index, 'id', e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                            placeholder="ID"
                          />
                          <input
                            type="text"
                            value={choice.label}
                            onChange={e => updateChoice(index, 'label', e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                            placeholder="ラベル"
                          />
                          <button
                            type="button"
                            onClick={() => removeChoice(index)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                      選択肢がありません。「+ 選択肢を追加」をクリックして追加してください。
                    </p>
                  )}
                </div>
              )}

              {/* FA警告 */}
              {nodeQuestionCategory === 'FA' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    自由入力（FA）の設問は分岐条件を設定できません。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 接続追加タブ */}
          {activeTab === 'connection' && (
            <form onSubmit={handleAddConnection} className="space-y-5">
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
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectableNodes.map(node => (
                        <label
                          key={node.id}
                          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
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
                            <span className="font-medium text-gray-900 text-sm">{node.label}</span>
                            <span className="text-gray-500 text-xs ml-2">({node.id})</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded-lg">
                      接続可能なノードがありません。
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

              {/* 複合条件の切り替え */}
              {conditionNodes.length >= 2 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCompoundCondition}
                      onChange={e => {
                        setUseCompoundCondition(e.target.checked);
                        if (!e.target.checked) {
                          setCompoundConditions(new Map());
                        }
                      }}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm font-medium text-purple-800">
                      複合条件を使用
                    </span>
                  </label>
                </div>
              )}

              {/* 複合条件設定UI */}
              {useCompoundCondition && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    複合条件設定
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {conditionNodes.map(node => {
                      const currentCondition = compoundConditions.get(node.id);
                      const isSelected = !!currentCondition;

                      return (
                        <div
                          key={node.id}
                          className={`p-2 rounded-lg border ${
                            isSelected ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'
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
                                      if (node.questionCategory === 'SA') {
                                        updateCompoundCondition(node.id, {
                                          nodeId: node.id,
                                          conditionType: 'choice',
                                          choiceCondition: { choiceIds: [choice.id] },
                                        });
                                      } else {
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
                                      }
                                    }}
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      isChoiceSelected
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white text-gray-700 border border-gray-300'
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

              {/* FA警告 */}
              {currentIsFreeAnswer && !useCompoundCondition && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    自由入力（FA）は分岐条件を設定できません。
                  </p>
                </div>
              )}

              {/* 選択肢による分岐条件 */}
              {currentHasChoices && !useCompoundCondition && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分岐条件
                  </label>
                  <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg">
                    {nodeChoices.map(choice => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => {
                          if (currentQuestionCategory === 'SA') {
                            setSelectedChoiceIds([choice.id]);
                          } else {
                            if (selectedChoiceIds.includes(choice.id)) {
                              setSelectedChoiceIds(selectedChoiceIds.filter(id => id !== choice.id));
                            } else {
                              setSelectedChoiceIds([...selectedChoiceIds, choice.id]);
                            }
                          }
                        }}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          selectedChoiceIds.includes(choice.id)
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 数値条件 */}
              {currentIsNumeric && !useCompoundCondition && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分岐条件
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

              {/* 条件ラベル */}
              {(!currentQuestionCategory || useCompoundCondition) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    条件ラベル（任意）
                  </label>
                  <input
                    type="text"
                    value={conditionLabel}
                    onChange={e => setConditionLabel(e.target.value)}
                    placeholder="例: Yes, No"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                      <span className="font-medium text-gray-900 text-xs">{option.label}</span>
                      <span className="text-gray-400 text-xs ml-1">{option.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 接続追加ボタン */}
              <button
                type="submit"
                disabled={!isConnectionValid}
                className="w-full py-2.5 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                接続を追加
              </button>
            </form>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            閉じる
          </button>
          {activeTab === 'settings' && (
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!isSettingsValid}
              className="flex-1 py-2.5 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              設定を保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
