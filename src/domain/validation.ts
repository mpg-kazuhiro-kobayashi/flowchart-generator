/**
 * バリデーション関連のユーティリティ関数
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * ノードIDのバリデーション
 * Mermaid.jsのクリックイベント抽出で正規表現が正しく動作するよう、
 * 英数字とアンダースコアのみ許可し、ハイフンは禁止
 */
export function validateNodeId(id: string): ValidationResult {
  if (!id) {
    return { valid: false, message: 'IDは必須です' };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(id)) {
    return { valid: false, message: 'IDは英字で始まり、英数字とアンダースコアのみ使用できます' };
  }
  return { valid: true };
}
