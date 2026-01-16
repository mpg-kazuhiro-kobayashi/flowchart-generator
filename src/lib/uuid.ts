/**
 * UUID生成ユーティリティ
 *
 * 生成されるIDは以下の要件を満たす:
 * - 英数字のみで構成
 * - 英字で始まる
 * - 一意性を保証
 */

/**
 * 英数字のみで構成され、英字で始まるIDを生成する
 * @returns ID文字列（例: "a1b2c3d4e5f6g7h8"）
 */
export function generateUUID(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  // 最初の文字は英字
  let result = letters[Math.floor(Math.random() * letters.length)];

  // 残り15文字は英数字
  for (let i = 0; i < 15; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

/**
 * ノード用の短縮IDを生成する
 * @returns 短縮ID（8文字）
 */
export function generateShortUUID(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  let result = letters[Math.floor(Math.random() * letters.length)];

  for (let i = 0; i < 7; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}
