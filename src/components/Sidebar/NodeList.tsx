'use client';

import { CustomNode, QuestionCategory } from '@/types/flowchart';
import { CoverageResult, EdgeConflict, CompoundCoverageResult } from '@/domain/coverage';
import { rangeToString } from '@/domain/numericRange';

// 設問カテゴリ
const questionCategories: { value: QuestionCategory | ''; label: string; description: string }[] = [
  { value: '', label: '設問なし', description: '通常のノード' },
  { value: 'SA', label: 'SA（単一選択）', description: '選択肢から1つ選択' },
  { value: 'MA', label: 'MA（複数選択）', description: '選択肢から複数選択' },
  { value: 'FA', label: 'FA（自由入力）', description: 'テキスト入力（分岐不可）' },
  { value: 'NA', label: 'NA（数値入力）', description: '数値入力（条件分岐可能）' },
];

interface NodeListProps {
  nodes: CustomNode[];
  coverageMap: Map<string, CoverageResult>;
  conflictMap: Map<string, EdgeConflict[]>;
  compoundCoverageMap: Map<string, CompoundCoverageResult>;
  editingChoicesIndex: number | null;
  onAddNode: () => void;
  onUpdateNode: (index: number, updates: Partial<CustomNode>) => void;
  onRemoveNode: (index: number) => void;
  onToggleChoicesEdit: (index: number) => void;
  onAddChoice: (nodeIndex: number) => void;
  onRemoveChoice: (nodeIndex: number, choiceIndex: number) => void;
  onUpdateChoice: (nodeIndex: number, choiceIndex: number, field: 'label', value: string) => void;
}

export default function NodeList({
  nodes,
  coverageMap,
  conflictMap,
  compoundCoverageMap,
  editingChoicesIndex,
  onAddNode,
  onUpdateNode,
  onRemoveNode,
  onToggleChoicesEdit,
  onAddChoice,
  onRemoveChoice,
  onUpdateChoice,
}: NodeListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">ノード</h3>
        <button
          onClick={onAddNode}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
        >
          + 追加
        </button>
      </div>
      <div className="space-y-3">
        {nodes.map((node, index) => {
          const coverage = coverageMap.get(node.id);
          const conflicts = conflictMap.get(node.id) || [];
          const compoundCoverage = compoundCoverageMap.get(node.id);
          const hasWarning = coverage && !coverage.isCovered;
          const hasCompoundWarning = compoundCoverage && !compoundCoverage.isFullyCovered;
          const hasConflict = conflicts.length > 0;
          return (
            <div key={node.id} className={`p-3 rounded-lg border ${
              hasConflict ? 'bg-red-50 border-red-300' : (hasWarning || hasCompoundWarning) ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'
            }`}>
              {/* 基本情報行 */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={node.label}
                  onChange={e => onUpdateNode(index, { label: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                  placeholder="ラベル"
                />
                <button
                  onClick={() => onRemoveNode(index)}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  削除
                </button>
              </div>

              {/* 設問カテゴリ選択 */}
              <div className="mt-2 flex gap-2 items-center">
                <span className="text-xs text-gray-600 min-w-16">設問タイプ:</span>
                <select
                  value={node.questionCategory || ''}
                  onChange={e => {
                    const category = e.target.value as QuestionCategory | '';
                    if (category) {
                      const updates: Partial<CustomNode> = { questionCategory: category };
                      // SA/MAの場合、選択肢がなければ初期化
                      if ((category === 'SA' || category === 'MA') && !node.choices) {
                        updates.choices = [];
                      }
                      onUpdateNode(index, updates);
                    } else {
                      onUpdateNode(index, { questionCategory: undefined, choices: undefined });
                    }
                  }}
                  className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                >
                  {questionCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {/* SA/MAの場合、選択肢編集ボタン */}
                {(node.questionCategory === 'SA' || node.questionCategory === 'MA') && (
                  <button
                    onClick={() => onToggleChoicesEdit(index)}
                    className={`px-2 py-1 text-xs rounded ${
                      editingChoicesIndex === index
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    選択肢 ({node.choices?.length || 0})
                  </button>
                )}
              </div>

              {/* カテゴリの説明 */}
              {node.questionCategory && (
                <div className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    node.questionCategory === 'FA' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {questionCategories.find(c => c.value === node.questionCategory)?.description}
                    {node.questionCategory === 'FA' && ' - 分岐設定不可'}
                  </span>
                </div>
              )}

              {/* 網羅性警告 */}
              {coverage && !coverage.isCovered && (
                <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs">
                  <div className="flex items-center gap-1 text-amber-800 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {!coverage.hasOutgoingEdges
                      ? '出力エッジがありません'
                      : coverage.questionCategory === 'NA'
                        ? '数値条件が全範囲をカバーしていません'
                        : '未使用の選択肢があります'}
                  </div>
                  {coverage.unusedChoices.length > 0 && (
                    <div className="mt-1 text-amber-700">
                      未使用: {coverage.unusedChoices.map(c => c.label).join(', ')}
                    </div>
                  )}
                  {coverage.numericGaps && coverage.numericGaps.length > 0 && (
                    <div className="mt-1 text-amber-700">
                      <span>未カバー範囲:</span>
                      <ul className="list-disc list-inside ml-2">
                        {coverage.numericGaps.map((gap, gapIndex) => (
                          <li key={gapIndex}>{rangeToString(gap)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* エッジ条件競合警告 */}
              {conflicts.length > 0 && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs">
                  <div className="flex items-center gap-1 text-red-800 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    エッジ条件が競合しています
                  </div>
                  <ul className="mt-1 text-red-700 space-y-0.5">
                    {conflicts.map((conflict, conflictIndex) => (
                      <li key={conflictIndex}>
                        <span className="font-medium">
                          {conflict.type === 'exact' ? '完全一致' : conflict.type === 'partial' ? '部分重複' : '包含関係'}:
                        </span>{' '}
                        {conflict.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 複合条件の組み合わせ未網羅警告 */}
              {compoundCoverage && !compoundCoverage.isFullyCovered && (
                <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs">
                  <div className="flex items-center gap-1 text-amber-800 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    未網羅の条件組み合わせがあります
                  </div>
                  <div className="mt-1 text-amber-700">
                    <ul className="list-disc list-inside ml-2">
                      {compoundCoverage.uncoveredCombinations.map((combo, comboIndex) => (
                        <li key={comboIndex}>
                          {combo.conditions.map((c, i) => (
                            <span key={c.nodeId}>
                              {i > 0 && ' AND '}
                              {c.nodeLabel}: {c.choiceLabel}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* 選択肢編集エリア（SA/MA） */}
              {editingChoicesIndex === index && (node.questionCategory === 'SA' || node.questionCategory === 'MA') && (
                <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">選択肢一覧</span>
                    <button
                      onClick={() => onAddChoice(index)}
                      className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      + 追加
                    </button>
                  </div>
                  {node.choices && node.choices.length > 0 ? (
                    <div className="space-y-1">
                      {node.choices.map((choice, choiceIndex) => (
                        <div key={choiceIndex} className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={choice.label}
                            onChange={e => onUpdateChoice(index, choiceIndex, 'label', e.target.value)}
                            className="flex-1 px-1 py-0.5 text-xs border rounded bg-white text-gray-900"
                            placeholder="ラベル"
                          />
                          <button
                            onClick={() => onRemoveChoice(index, choiceIndex)}
                            className="px-1 py-0.5 text-xs bg-red-400 text-white rounded hover:bg-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">
                      選択肢がありません。「+ 追加」で選択肢を追加してください。
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
