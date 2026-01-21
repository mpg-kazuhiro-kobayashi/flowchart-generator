'use client';

import { useState, useEffect } from 'react';
import { FlowchartNode, EdgeStyle, NumericOperator, ChoiceOption, QuestionCategory, NodeEntryRule, NodeVisibilityCondition, SingleCondition } from '@/types/flowchart';
import { NumericRange, rangeToString } from '@/domain/numericRange';
import { EdgeConflict } from '@/domain/coverage';
import { generateUUID } from '@/lib/uuid';

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

/** ノード更新の結果 */
export interface NodeUpdateResult {
  label: string;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
}

/** 網羅性チェック結果 */
export interface CoverageInfo {
  unusedChoices: ChoiceOption[];
  isCovered: boolean;
  hasOutgoingEdges: boolean;
  outgoingEdgeCount: number;
  questionCategory: QuestionCategory;
  /** 数値条件のギャップ（NA用） */
  numericGaps?: NumericRange[];
}

interface NodeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: (FlowchartNode & { questionCategory?: QuestionCategory; choices?: ChoiceOption[]; entryRules?: NodeEntryRule[] }) | null;
  availableNodes: FlowchartNode[];
  conditionNodes?: ConditionNode[];
  onUpdateNode: (nodeId: string, update: NodeUpdateResult) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddEntryRule?: (nodeId: string, rule: Omit<NodeEntryRule, 'id'>) => void;
  onUpdateEntryRule?: (nodeId: string, ruleId: string, updates: Partial<NodeEntryRule>) => void;
  onRemoveEntryRule?: (nodeId: string, ruleId: string) => void;
  /** 網羅性チェック結果 */
  coverageInfo?: CoverageInfo;
  /** エッジ条件競合情報 */
  edgeConflicts?: EdgeConflict[];
}

type TabType = 'settings' | 'entryRules';
type ConditionType = 'always' | 'choice' | 'numeric' | 'compound' | 'default';

export default function NodeEditDialog({
  isOpen,
  onClose,
  sourceNode,
  availableNodes,
  conditionNodes = [],
  onUpdateNode,
  onDeleteNode,
  onAddEntryRule,
  onUpdateEntryRule: _onUpdateEntryRule,
  onRemoveEntryRule,
  coverageInfo,
  edgeConflicts = [],
}: NodeEditDialogProps) {
  // タブ状態
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  // ノード設定用の状態
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeQuestionCategory, setNodeQuestionCategory] = useState<QuestionCategory | ''>('');
  const [nodeChoices, setNodeChoices] = useState<ChoiceOption[]>([]);

  // 到達ルール追加用の状態
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleSourceNodeId, setNewRuleSourceNodeId] = useState<string>('');
  const [newRuleConditionType, setNewRuleConditionType] = useState<ConditionType>('always');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [newRuleStyle, setNewRuleStyle] = useState<EdgeStyle>('solid');
  const [newRuleSelectedChoiceIds, setNewRuleSelectedChoiceIds] = useState<string[]>([]);
  const [newRuleNumericOperator, setNewRuleNumericOperator] = useState<NumericOperator>('eq');
  const [newRuleNumericValue, setNewRuleNumericValue] = useState<string>('');
  const [newRuleCompoundConditions, setNewRuleCompoundConditions] = useState<Map<string, SingleCondition>>(new Map());

  // 新しいルール状態をリセット
  const resetNewRuleState = () => {
    setNewRuleSourceNodeId(availableNodes.length > 0 ? availableNodes[0].id : '');
    setNewRuleConditionType('always');
    setNewRuleLabel('');
    setNewRuleStyle('solid');
    setNewRuleSelectedChoiceIds([]);
    setNewRuleNumericOperator('eq');
    setNewRuleNumericValue('');
    setNewRuleCompoundConditions(new Map());
  };

  // ダイアログが開いたときに状態をリセット
  useEffect(() => {
    if (isOpen && sourceNode) {
      // ノード設定を初期化
      setNodeLabel(sourceNode.label);
      setNodeQuestionCategory(sourceNode.questionCategory || '');
      setNodeChoices(sourceNode.choices ? [...sourceNode.choices] : []);

      // 到達ルール追加をリセット
      setIsAddingRule(false);
      resetNewRuleState();

      // デフォルトタブ
      setActiveTab('settings');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceNode]);

  // 利用可能なノード（ソースノード自身を除く）
  const selectableNodes = availableNodes.filter(n => n.id !== sourceNode?.id);

  // 選択されたソースノードの情報
  const selectedSourceConditionNode = conditionNodes.find(n => n.id === newRuleSourceNodeId);
  const sourceHasChoices = selectedSourceConditionNode?.choices && selectedSourceConditionNode.choices.length > 0;
  const sourceIsNumeric = selectedSourceConditionNode?.questionCategory === 'NA';

  // 選択肢追加
  const addChoice = () => {
    const newId = generateUUID();
    setNodeChoices([...nodeChoices, { id: newId, label: `選択肢${nodeChoices.length + 1}` }]);
  };

  // 選択肢削除
  const removeChoice = (index: number) => {
    setNodeChoices(nodeChoices.filter((_, i) => i !== index));
  };

  // 選択肢更新
  const updateChoice = (index: number, field: 'label', value: string) => {
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

  // 条件ラベルを自動生成
  const generateConditionLabel = (): string => {
    if (newRuleConditionType === 'always') {
      return '';
    }
    if (newRuleConditionType === 'default') {
      return 'その他';
    }
    if (newRuleConditionType === 'choice' && selectedSourceConditionNode?.choices && newRuleSelectedChoiceIds.length > 0) {
      const selectedLabels = selectedSourceConditionNode.choices
        .filter(c => newRuleSelectedChoiceIds.includes(c.id))
        .map(c => c.label);
      return selectedLabels.join(', ');
    }
    if (newRuleConditionType === 'numeric' && newRuleNumericValue) {
      const op = numericOperators.find(o => o.value === newRuleNumericOperator);
      return `${op?.symbol || ''} ${newRuleNumericValue}`;
    }
    if (newRuleConditionType === 'compound' && newRuleCompoundConditions.size > 0) {
      const parts: string[] = [];
      for (const [nodeId, condition] of newRuleCompoundConditions) {
        const node = conditionNodes.find(n => n.id === nodeId);
        if (node && condition.choiceCondition) {
          const choiceLabels = node.choices
            ?.filter(c => condition.choiceCondition!.choiceIds.includes(c.id))
            .map(c => c.label) || [];
          parts.push(`${node.label}: ${choiceLabels.join(', ')}`);
        } else if (node && condition.numericCondition) {
          const op = numericOperators.find(o => o.value === condition.numericCondition!.operator);
          parts.push(`${node.label}: ${op?.symbol || ''} ${condition.numericCondition!.value}`);
        }
      }
      return parts.join(' AND ');
    }
    return newRuleLabel;
  };

  // 到達ルール追加を実行
  const handleAddEntryRule = () => {
    if (!sourceNode || !onAddEntryRule || !newRuleSourceNodeId) return;

    let visibilityCondition: NodeVisibilityCondition | undefined;

    switch (newRuleConditionType) {
      case 'always':
        visibilityCondition = { type: 'always' };
        break;
      case 'default':
        visibilityCondition = { type: 'default' };
        break;
      case 'choice':
        if (newRuleSelectedChoiceIds.length > 0) {
          visibilityCondition = { type: 'choice', choiceIds: newRuleSelectedChoiceIds };
        }
        break;
      case 'numeric':
        if (newRuleNumericValue) {
          visibilityCondition = {
            type: 'numeric',
            numeric: {
              operator: newRuleNumericOperator,
              value: parseFloat(newRuleNumericValue),
            },
          };
        }
        break;
      case 'compound':
        if (newRuleCompoundConditions.size >= 1) {
          const conditions = Array.from(newRuleCompoundConditions.values());
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

    const finalLabel = newRuleLabel || generateConditionLabel();

    const newRule: Omit<NodeEntryRule, 'id'> = {
      sourceNodeId: newRuleSourceNodeId,
      label: finalLabel,
      style: newRuleStyle,
      visibilityCondition,
    };

    onAddEntryRule(sourceNode.id, newRule);
    setIsAddingRule(false);
    resetNewRuleState();
  };

  // 到達ルール削除
  const handleRemoveEntryRule = (ruleId: string) => {
    if (!sourceNode || !onRemoveEntryRule) return;
    if (confirm('この到達ルールを削除しますか？')) {
      onRemoveEntryRule(sourceNode.id, ruleId);
    }
  };

  // 複合条件を更新するヘルパー関数
  const updateCompoundCondition = (nodeId: string, condition: SingleCondition | null) => {
    const newConditions = new Map(newRuleCompoundConditions);
    if (condition) {
      newConditions.set(nodeId, condition);
    } else {
      newConditions.delete(nodeId);
    }
    setNewRuleCompoundConditions(newConditions);
  };

  // バリデーション
  const isNewRuleValid = (() => {
    if (!newRuleSourceNodeId) return false;
    switch (newRuleConditionType) {
      case 'always':
      case 'default':
        return true;
      case 'choice':
        return newRuleSelectedChoiceIds.length > 0;
      case 'numeric':
        return newRuleNumericValue !== '';
      case 'compound':
        return newRuleCompoundConditions.size >= 1;
      default:
        return false;
    }
  })();

  const isSettingsValid = nodeLabel.trim() !== '';
  const isRootNode = !sourceNode?.entryRules || sourceNode.entryRules.length === 0;

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
            {isRootNode && <span className="ml-2 px-2 py-0.5 bg-blue-400 rounded text-xs">ルートノード</span>}
          </p>
        </div>

        {/* 網羅性警告 */}
        {coverageInfo && !coverageInfo.isCovered && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  {!coverageInfo.hasOutgoingEdges
                    ? '出力エッジがありません'
                    : coverageInfo.questionCategory === 'NA'
                      ? '数値条件が全範囲をカバーしていません'
                      : '未使用の選択肢があります'}
                </p>
                {coverageInfo.unusedChoices.length > 0 && (
                  <p className="text-amber-700 mt-1">
                    未使用: {coverageInfo.unusedChoices.map(c => c.label).join(', ')}
                  </p>
                )}
                {coverageInfo.numericGaps && coverageInfo.numericGaps.length > 0 && (
                  <div className="text-amber-700 mt-1">
                    <p>未カバー範囲:</p>
                    <ul className="list-disc list-inside ml-2">
                      {coverageInfo.numericGaps.map((gap, index) => (
                        <li key={index}>{rangeToString(gap)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* エッジ条件競合警告 */}
        {edgeConflicts.length > 0 && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-red-800">
                  エッジ条件が競合しています
                </p>
                <ul className="text-red-700 mt-1 space-y-1">
                  {edgeConflicts.map((conflict, index) => (
                    <li key={index} className="text-xs">
                      <span className="font-medium">
                        {conflict.type === 'exact' ? '完全一致' : conflict.type === 'partial' ? '部分重複' : '包含関係'}:
                      </span>{' '}
                      {conflict.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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
            onClick={() => setActiveTab('entryRules')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'entryRules'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            到達ルール
            {sourceNode.entryRules && sourceNode.entryRules.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                {sourceNode.entryRules.length}
              </span>
            )}
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

              {/* 削除セクション */}
              {onDeleteNode && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (sourceNode && confirm(`ノード「${sourceNode.label}」を削除しますか？\n関連する到達ルールも削除されます。`)) {
                        onDeleteNode(sourceNode.id);
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    このノードを削除
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 到達ルールタブ */}
          {activeTab === 'entryRules' && (
            <div className="space-y-4">
              {/* 既存の到達ルール一覧 */}
              {sourceNode.entryRules && sourceNode.entryRules.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    現在の到達ルール
                  </label>
                  {sourceNode.entryRules.map(rule => {
                    const sourceNodeInfo = availableNodes.find(n => n.id === rule.sourceNodeId);
                    return (
                      <div key={rule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {sourceNodeInfo?.label || rule.sourceNodeId} →
                            </div>
                            {rule.label && (
                              <div className="text-xs text-gray-600 mt-1">
                                ラベル: {rule.label}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              条件: {rule.visibilityCondition?.type || 'なし'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntryRule(rule.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <p className="text-sm text-blue-800">
                    到達ルールがありません。このノードはルートノードとして扱われます。
                  </p>
                </div>
              )}

              {/* 到達ルール追加フォーム */}
              {isAddingRule ? (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-green-800">新しい到達ルールを追加</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingRule(false);
                        resetNewRuleState();
                      }}
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
                      value={newRuleSourceNodeId}
                      onChange={e => {
                        setNewRuleSourceNodeId(e.target.value);
                        setNewRuleSelectedChoiceIds([]);
                        setNewRuleNumericValue('');
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
                      value={newRuleConditionType}
                      onChange={e => setNewRuleConditionType(e.target.value as ConditionType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="always">無条件</option>
                      {sourceHasChoices && <option value="choice">選択肢条件</option>}
                      {sourceIsNumeric && <option value="numeric">数値条件</option>}
                      {conditionNodes.length >= 1 && <option value="compound">複合条件</option>}
                      <option value="default">デフォルト（その他）</option>
                    </select>
                  </div>

                  {/* 選択肢条件 */}
                  {newRuleConditionType === 'choice' && selectedSourceConditionNode?.choices && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        選択肢（複数選択可）
                      </label>
                      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-gray-200">
                        {selectedSourceConditionNode.choices.map(choice => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => {
                              if (newRuleSelectedChoiceIds.includes(choice.id)) {
                                setNewRuleSelectedChoiceIds(newRuleSelectedChoiceIds.filter(id => id !== choice.id));
                              } else {
                                setNewRuleSelectedChoiceIds([...newRuleSelectedChoiceIds, choice.id]);
                              }
                            }}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              newRuleSelectedChoiceIds.includes(choice.id)
                                ? 'bg-green-500 text-white'
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
                  {newRuleConditionType === 'numeric' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        数値条件
                      </label>
                      <div className="flex gap-2 items-center">
                        <select
                          value={newRuleNumericOperator}
                          onChange={e => setNewRuleNumericOperator(e.target.value as NumericOperator)}
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
                          value={newRuleNumericValue}
                          onChange={e => setNewRuleNumericValue(e.target.value)}
                          placeholder="値を入力"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* 複合条件 */}
                  {newRuleConditionType === 'compound' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        複合条件設定（AND条件）
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {conditionNodes.map(node => {
                          const currentCondition = newRuleCompoundConditions.get(node.id);
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

                  {/* ラベル */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ラベル（任意）
                    </label>
                    <input
                      type="text"
                      value={newRuleLabel}
                      onChange={e => setNewRuleLabel(e.target.value)}
                      placeholder={generateConditionLabel() || '自動生成されます'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>

                  {/* 追加ボタン */}
                  <button
                    type="button"
                    onClick={handleAddEntryRule}
                    disabled={!isNewRuleValid}
                    className="w-full py-2.5 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    到達ルールを追加
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingRule(true)}
                  disabled={selectableNodes.length === 0}
                  className="w-full py-2.5 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  到達ルールを追加
                </button>
              )}
            </div>
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
