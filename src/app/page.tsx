'use client';

import { useState, useMemo, useCallback } from 'react';
import FlowchartRenderer from '@/components/FlowchartRenderer';
import AddConditionDialog from '@/components/AddConditionDialog';
import { FlowchartGenerator } from '@/lib/flowchartGenerator';
import { validateNodeId } from '@/lib/validation';
import { FlowchartDefinition, FlowchartNode, NodeShape, EdgeStyle, QuestionCategory, ChoiceOption, STATE_NODE_PREFIX, CompoundCondition } from '@/types/flowchart';
import { AddConditionResult } from '@/components/AddConditionDialog';

// 利用可能なノード形状
const nodeShapes: { value: NodeShape; label: string }[] = [
  { value: 'rectangle', label: '四角形 [text]' },
  { value: 'round', label: '角丸 (text)' },
  { value: 'stadium', label: 'スタジアム ([text])' },
  { value: 'subroutine', label: 'サブルーチン [[text]]' },
  { value: 'database', label: 'データベース [(text)]' },
  { value: 'circle', label: '円 ((text))' },
  { value: 'doubleCircle', label: '二重円 (((text)))' },
  { value: 'rhombus', label: 'ひし形 {text}' },
  { value: 'hexagon', label: '六角形 {{text}}' },
  { value: 'parallelogram', label: '平行四辺形 [/text/]' },
  { value: 'trapezoid', label: '台形 [/text\\]' },
];

// 利用可能なエッジスタイル
const edgeStyles: { value: EdgeStyle; label: string }[] = [
  { value: 'solid', label: '実線矢印 -->' },
  { value: 'dotted', label: '点線矢印 -.->' },
  { value: 'thick', label: '太線矢印 ==>' },
  { value: 'solidNoArrow', label: '実線 ---' },
  { value: 'biDirectional', label: '双方向 <-->' },
  { value: 'circleEnd', label: '丸終端 --o' },
  { value: 'crossEnd', label: 'X終端 --x' },
];

// 設問カテゴリ
const questionCategories: { value: QuestionCategory | ''; label: string; description: string }[] = [
  { value: '', label: '設問なし', description: '通常のノード' },
  { value: 'SA', label: 'SA（単一選択）', description: '選択肢から1つ選択' },
  { value: 'MA', label: 'MA（複数選択）', description: '選択肢から複数選択' },
  { value: 'FA', label: 'FA（自由入力）', description: 'テキスト入力（分岐不可）' },
  { value: 'NA', label: 'NA（数値入力）', description: '数値入力（条件分岐可能）' },
];

// カスタムノードの型定義
interface CustomNode {
  id: string;
  label: string;
  shape: NodeShape;
  questionCategory?: QuestionCategory;
  choices?: ChoiceOption[];
  /** 状態ノードの場合、対応する複合条件 */
  compoundCondition?: CompoundCondition;
}

/**
 * 状態ノードかどうかを判定
 */
const isStateNode = (nodeId: string): boolean => {
  return nodeId.startsWith(STATE_NODE_PREFIX);
};

/**
 * 複合条件から状態ノードのIDを生成
 */
const generateStateNodeId = (conditions: CompoundCondition['conditions']): string => {
  const parts = conditions.map(c => {
    if (c.conditionType === 'choice' && c.choiceCondition) {
      return `${c.nodeId}_${c.choiceCondition.choiceIds.join('_')}`;
    }
    if (c.conditionType === 'numeric' && c.numericCondition) {
      return `${c.nodeId}_${c.numericCondition.operator}${c.numericCondition.value}`;
    }
    return c.nodeId;
  });
  return `${STATE_NODE_PREFIX}${parts.join('_')}`;
};

/**
 * 複合条件からラベルを生成
 */
const generateStateNodeLabel = (conditions: CompoundCondition['conditions'], nodes: CustomNode[]): string => {
  const parts = conditions.map(c => {
    const node = nodes.find(n => n.id === c.nodeId);
    const nodeName = node?.label || c.nodeId;

    if (c.conditionType === 'choice' && c.choiceCondition) {
      const choiceLabels = c.choiceCondition.choiceIds.map(choiceId => {
        const choice = node?.choices?.find(ch => ch.id === choiceId);
        return choice?.label || choiceId;
      });
      return `${nodeName}: ${choiceLabels.join(', ')}`;
    }
    if (c.conditionType === 'numeric' && c.numericCondition) {
      const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[c.numericCondition.operator];
      return `${nodeName} ${opSymbol} ${c.numericCondition.value}`;
    }
    return nodeName;
  });
  return parts.join(' AND ');
};

export default function Home() {
  // カスタムエディター用の状態
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([
    { id: 'A', label: 'Start', shape: 'stadium' },
    { id: 'B', label: 'Process', shape: 'rectangle' },
    { id: 'C', label: 'End', shape: 'stadium' },
  ]);

  // 選択肢編集中のノードインデックス
  const [editingChoicesIndex, setEditingChoicesIndex] = useState<number | null>(null);
  const [customEdges, setCustomEdges] = useState<Array<{ from: string; to: string; label: string; style: EdgeStyle }>>([
    { from: 'A', to: 'B', label: '', style: 'solid' },
    { from: 'B', to: 'C', label: '', style: 'solid' },
  ]);

  // ダイアログ用の状態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<FlowchartNode | null>(null);

  // サイドパネル表示用（状態ノードを除外）
  const displayNodes = useMemo(() => {
    return customNodes.filter(node => !isStateNode(node.id));
  }, [customNodes]);

  // サイドパネル表示用エッジ（状態ノード関連を除外）
  const displayEdges = useMemo(() => {
    return customEdges.filter(edge => !isStateNode(edge.from) && !isStateNode(edge.to));
  }, [customEdges]);

  // 条件設定可能なノード一覧（SA/MA/NA の設問ノード、FAは分岐不可なので除外）
  const conditionNodes = useMemo(() => {
    return customNodes.filter(node =>
      node.questionCategory &&
      node.questionCategory !== 'FA' &&
      !isStateNode(node.id)
    );
  }, [customNodes]);

  // フローチャート定義
  const currentDefinition = useMemo((): FlowchartDefinition => {
    return {
      direction: 'TD' as const,
      nodes: customNodes,
      edges: customEdges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.label || undefined,
        style: e.style,
      })),
    };
  }, [customNodes, customEdges]);

  // Mermaid文字列を生成
  const mermaidCode = useMemo(() => {
    return FlowchartGenerator.generate(currentDefinition);
  }, [currentDefinition]);

  // ノードクリック時のハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    // クリックされたノードを探す
    const node = currentDefinition.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedSourceNode(node);
      setIsDialogOpen(true);
    } else {
      // ラベルで検索（フォールバック）
      const nodeByLabel = currentDefinition.nodes.find(n => n.label === nodeId);
      if (nodeByLabel) {
        setSelectedSourceNode(nodeByLabel);
        setIsDialogOpen(true);
      }
    }
  }, [currentDefinition.nodes]);

  // 条件追加のハンドラ
  const handleAddCondition = useCallback((result: AddConditionResult) => {
    if (!selectedSourceNode) return;

    // 新規ノードの作成
    if (result.createNewNode) {
      setCustomNodes(prev => [...prev, {
        id: result.createNewNode!.id,
        label: result.createNewNode!.label,
        shape: 'rectangle',
      }]);
    }

    // 複合条件の場合
    if (result.compoundCondition && result.compoundCondition.conditions.length > 0) {
      const stateNodeId = generateStateNodeId(result.compoundCondition.conditions);
      const stateNodeLabel = generateStateNodeLabel(result.compoundCondition.conditions, customNodes);

      // 既存の状態ノードがあるか確認
      const existingStateNode = customNodes.find(n => n.id === stateNodeId);

      if (!existingStateNode) {
        // 状態ノードを作成
        setCustomNodes(prev => [...prev, {
          id: stateNodeId,
          label: stateNodeLabel,
          shape: 'hexagon',
          compoundCondition: result.compoundCondition,
        }]);
      }

      // 各条件ノードから状態ノードへのエッジを追加
      const newEdges: Array<{ from: string; to: string; label: string; style: EdgeStyle }> = [];

      for (const cond of result.compoundCondition.conditions) {
        // 既に同じエッジがあるか確認
        const edgeExists = customEdges.some(e => e.from === cond.nodeId && e.to === stateNodeId);
        if (!edgeExists) {
          let edgeLabel = '';
          if (cond.conditionType === 'choice' && cond.choiceCondition) {
            const node = customNodes.find(n => n.id === cond.nodeId);
            const choiceLabels = cond.choiceCondition.choiceIds.map(choiceId => {
              const choice = node?.choices?.find(ch => ch.id === choiceId);
              return choice?.label || choiceId;
            });
            edgeLabel = choiceLabels.join(', ');
          } else if (cond.conditionType === 'numeric' && cond.numericCondition) {
            const opSymbol = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[cond.numericCondition.operator];
            edgeLabel = `${opSymbol} ${cond.numericCondition.value}`;
          }

          newEdges.push({
            from: cond.nodeId,
            to: stateNodeId,
            label: edgeLabel,
            style: 'dotted',
          });
        }
      }

      // 状態ノードから接続先へのエッジを追加
      newEdges.push({
        from: stateNodeId,
        to: result.targetNodeId,
        label: result.label,
        style: result.style,
      });

      setCustomEdges(prev => [...prev, ...newEdges]);
    } else {
      // 単一条件の場合（従来の動作）
      setCustomEdges(prev => [...prev, {
        from: selectedSourceNode.id,
        to: result.targetNodeId,
        label: result.label,
        style: result.style,
      }]);
    }

    setIsDialogOpen(false);
    setSelectedSourceNode(null);
  }, [selectedSourceNode, customNodes, customEdges]);

  // ノード追加
  const addNode = () => {
    const newId = String.fromCharCode(65 + customNodes.length); // A, B, C...
    setCustomNodes([...customNodes, { id: newId, label: `Node ${newId}`, shape: 'rectangle' }]);
  };

  // 選択肢追加
  const addChoice = (nodeIndex: number) => {
    const newNodes = [...customNodes];
    const node = newNodes[nodeIndex];
    const choices = node.choices || [];
    const newChoiceId = `${node.id}_opt${choices.length + 1}`;
    newNodes[nodeIndex].choices = [...choices, { id: newChoiceId, label: `選択肢${choices.length + 1}` }];
    setCustomNodes(newNodes);
  };

  // 選択肢削除
  const removeChoice = (nodeIndex: number, choiceIndex: number) => {
    const newNodes = [...customNodes];
    newNodes[nodeIndex].choices = newNodes[nodeIndex].choices?.filter((_, i) => i !== choiceIndex);
    setCustomNodes(newNodes);
  };

  // 選択肢更新
  const updateChoice = (nodeIndex: number, choiceIndex: number, field: 'id' | 'label', value: string) => {
    const newNodes = [...customNodes];
    if (newNodes[nodeIndex].choices) {
      newNodes[nodeIndex].choices![choiceIndex][field] = value;
      setCustomNodes(newNodes);
    }
  };

  // ノード削除
  const removeNode = (index: number) => {
    const nodeId = customNodes[index].id;
    setCustomNodes(customNodes.filter((_, i) => i !== index));
    setCustomEdges(customEdges.filter(e => e.from !== nodeId && e.to !== nodeId));
  };

  // エッジ追加
  const addEdge = () => {
    if (customNodes.length >= 2) {
      setCustomEdges([...customEdges, { from: customNodes[0].id, to: customNodes[1].id, label: '', style: 'solid' }]);
    }
  };

  // エッジ削除
  const removeEdge = (index: number) => {
    setCustomEdges(customEdges.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flowchart Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            JavaScript Object から Mermaid フローチャートを生成 ・ ノードをクリックして条件を追加
          </p>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左パネル: コントロール */}
        <div className="w-1/3 p-4 overflow-y-auto border-r border-gray-200 bg-white">
          {/* 操作説明 */}
          <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>ヒント:</strong> フローチャートのノードをクリックすると、そのノードから新しい接続を追加できます。
            </p>
          </div>

          {/* ノードエディター */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">ノード</h3>
                <button
                  onClick={addNode}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  + 追加
                </button>
              </div>
              <div className="space-y-3">
                {displayNodes.map((node) => {
                  const index = customNodes.findIndex(n => n.id === node.id);
                  const idValidation = validateNodeId(node.id);
                  return (
                  <div key={node.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {/* 基本情報行 */}
                    <div className="flex gap-2 items-center">
                      <div className="relative">
                        <input
                          type="text"
                          value={node.id}
                          onChange={e => {
                            const newNodes = [...customNodes];
                            const oldId = newNodes[index].id;
                            newNodes[index].id = e.target.value;
                            setCustomNodes(newNodes);
                            // エッジのIDも更新
                            setCustomEdges(customEdges.map(edge => ({
                              ...edge,
                              from: edge.from === oldId ? e.target.value : edge.from,
                              to: edge.to === oldId ? e.target.value : edge.to,
                            })));
                          }}
                          className={`w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900 ${
                            !idValidation.valid ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="ID"
                          title={idValidation.message || 'ノードID'}
                        />
                        {!idValidation.valid && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center" title={idValidation.message}>!</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={node.label}
                        onChange={e => {
                          const newNodes = [...customNodes];
                          newNodes[index].label = e.target.value;
                          setCustomNodes(newNodes);
                        }}
                        className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                        placeholder="ラベル"
                      />
                      <select
                        value={node.shape}
                        onChange={e => {
                          const newNodes = [...customNodes];
                          newNodes[index].shape = e.target.value as NodeShape;
                          setCustomNodes(newNodes);
                        }}
                        className="px-2 py-1 text-xs border rounded bg-white text-gray-900"
                      >
                        {nodeShapes.map(shape => (
                          <option key={shape.value} value={shape.value}>
                            {shape.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeNode(index)}
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
                          const newNodes = [...customNodes];
                          const category = e.target.value as QuestionCategory | '';
                          if (category) {
                            newNodes[index].questionCategory = category;
                            // SA/MAの場合、選択肢がなければ初期化
                            if ((category === 'SA' || category === 'MA') && !newNodes[index].choices) {
                              newNodes[index].choices = [];
                            }
                          } else {
                            delete newNodes[index].questionCategory;
                            delete newNodes[index].choices;
                          }
                          setCustomNodes(newNodes);
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
                          onClick={() => setEditingChoicesIndex(editingChoicesIndex === index ? null : index)}
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

                    {/* 選択肢編集エリア（SA/MA） */}
                    {editingChoicesIndex === index && (node.questionCategory === 'SA' || node.questionCategory === 'MA') && (
                      <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">選択肢一覧</span>
                          <button
                            onClick={() => addChoice(index)}
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
                                  value={choice.id}
                                  onChange={e => updateChoice(index, choiceIndex, 'id', e.target.value)}
                                  className="w-20 px-1 py-0.5 text-xs border rounded bg-white text-gray-900"
                                  placeholder="ID"
                                />
                                <input
                                  type="text"
                                  value={choice.label}
                                  onChange={e => updateChoice(index, choiceIndex, 'label', e.target.value)}
                                  className="flex-1 px-1 py-0.5 text-xs border rounded bg-white text-gray-900"
                                  placeholder="ラベル"
                                />
                                <button
                                  onClick={() => removeChoice(index, choiceIndex)}
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

            {/* エッジエディター */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">エッジ（接続）</h3>
                <button
                  onClick={addEdge}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  disabled={customNodes.length < 2}
                >
                  + 追加
                </button>
              </div>
              <div className="space-y-2">
                {displayEdges.map((edge) => {
                  const index = customEdges.findIndex(e => e.from === edge.from && e.to === edge.to && e.label === edge.label);
                  return (
                  <div key={`${edge.from}-${edge.to}-${index}`} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                    <select
                      value={edge.from}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].from = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {displayNodes.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.id}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edge.style}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].style = e.target.value as EdgeStyle;
                        setCustomEdges(newEdges);
                      }}
                      className="px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {edgeStyles.map(style => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edge.to}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].to = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="w-16 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                    >
                      {displayNodes.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.id}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={edge.label}
                      onChange={e => {
                        const newEdges = [...customEdges];
                        newEdges[index].label = e.target.value;
                        setCustomEdges(newEdges);
                      }}
                      className="flex-1 px-2 py-1 text-xs border rounded bg-white text-gray-900"
                      placeholder="ラベル（任意）"
                    />
                    <button
                      onClick={() => removeEdge(index)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      削除
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
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

        {/* 右パネル: プレビュー */}
        <div className="flex-1 p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">プレビュー（ノードをクリックして条件追加）</h2>
          <div className="bg-white rounded-lg shadow-sm h-[calc(100%-40px)]">
            <FlowchartRenderer
              mermaidCode={mermaidCode}
              onNodeClick={handleNodeClick}
            />
          </div>
        </div>
      </div>

      {/* 条件追加ダイアログ */}
      <AddConditionDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedSourceNode(null);
        }}
        sourceNode={selectedSourceNode}
        availableNodes={currentDefinition.nodes.filter(n => !isStateNode(n.id))}
        conditionNodes={conditionNodes}
        onAddCondition={handleAddCondition}
      />
    </div>
  );
}
