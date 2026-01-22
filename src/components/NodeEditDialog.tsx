'use client';

import { useState, useEffect } from 'react';
import { FlowchartNode, ChoiceOption, QuestionCategory, NodeEntryRule } from '@/types/flowchart';
import { NumericRange, rangeToString } from '@/domain/numericRange';
import { EdgeConflict } from '@/domain/coverage';
import { generateUUID } from '@/lib/uuid';
import EntryRuleEditor, { ConditionNode } from './EntryRuleEditor';

// 設問カテゴリオプション
const questionCategories: { value: QuestionCategory | ''; label: string; description: string }[] = [
  { value: '', label: '設問なし', description: '通常のノード' },
  { value: 'SA', label: 'SA（単一選択）', description: '選択肢から1つ選択' },
  { value: 'MA', label: 'MA（複数選択）', description: '選択肢から複数選択' },
  { value: 'FA', label: 'FA（自由入力）', description: 'テキスト入力（分岐不可）' },
  { value: 'NA', label: 'NA（数値入力）', description: '数値入力（条件分岐可能）' },
];

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

export default function NodeEditDialog({
  isOpen,
  onClose,
  sourceNode,
  availableNodes,
  conditionNodes = [],
  onUpdateNode,
  onDeleteNode,
  onAddEntryRule,
  onUpdateEntryRule,
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

  // 到達ルール用の状態（シンプル化）
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // ダイアログが開いたときに状態をリセット
  useEffect(() => {
    if (isOpen && sourceNode) {
      // ノード設定を初期化
      setNodeLabel(sourceNode.label);
      setNodeQuestionCategory(sourceNode.questionCategory || '');
      setNodeChoices(sourceNode.choices ? [...sourceNode.choices] : []);

      // 到達ルール追加をリセット
      setIsAddingRule(false);
      setEditingRuleId(null);

      // デフォルトタブ
      setActiveTab('settings');
    }
  }, [isOpen, sourceNode]);

  // 利用可能なノード（ソースノード自身を除く）
  const selectableNodes = availableNodes.filter(n => n.id !== sourceNode?.id);

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

  // 到達ルール追加ハンドラ
  const handleAddEntryRule = (rule: Omit<NodeEntryRule, 'id'>) => {
    if (!sourceNode || !onAddEntryRule) return;
    onAddEntryRule(sourceNode.id, rule);
    setIsAddingRule(false);
  };

  // 到達ルール更新ハンドラ
  const handleUpdateEntryRule = (rule: Omit<NodeEntryRule, 'id'>) => {
    if (!sourceNode || !onUpdateEntryRule || !editingRuleId) return;
    onUpdateEntryRule(sourceNode.id, editingRuleId, rule);
    setEditingRuleId(null);
  };

  // 到達ルール削除
  const handleRemoveEntryRule = (ruleId: string) => {
    if (!sourceNode || !onRemoveEntryRule) return;
    if (confirm('この到達ルールを削除しますか？')) {
      onRemoveEntryRule(sourceNode.id, ruleId);
    }
  };

  const isSettingsValid = nodeLabel.trim() !== '';
  const isRootNode = !sourceNode?.entryRules || sourceNode.entryRules.length === 0;

  // 編集中のルールを取得
  const editingRule = editingRuleId
    ? sourceNode?.entryRules?.find(r => r.id === editingRuleId)
    : undefined;

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
                    const isEditing = editingRuleId === rule.id;

                    if (isEditing && editingRule) {
                      // 編集モード - EntryRuleEditor を使用
                      return (
                        <EntryRuleEditor
                          key={rule.id}
                          mode="edit"
                          initialRule={editingRule}
                          targetNodeId={sourceNode.id}
                          availableNodes={availableNodes}
                          conditionNodes={conditionNodes}
                          onSave={handleUpdateEntryRule}
                          onCancel={() => setEditingRuleId(null)}
                        />
                      );
                    }

                    // 表示モード
                    return (
                      <div key={rule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {sourceNodeInfo?.label || rule.sourceNodeId} →
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              条件: {rule.visibilityCondition?.type || 'なし'}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingRuleId(rule.id)}
                              disabled={editingRuleId !== null || isAddingRule}
                              className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEntryRule(rule.id)}
                              disabled={editingRuleId !== null || isAddingRule}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              削除
                            </button>
                          </div>
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
                <EntryRuleEditor
                  mode="add"
                  targetNodeId={sourceNode.id}
                  availableNodes={availableNodes}
                  conditionNodes={conditionNodes}
                  onSave={handleAddEntryRule}
                  onCancel={() => setIsAddingRule(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingRule(true)}
                  disabled={selectableNodes.length === 0 || editingRuleId !== null}
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
