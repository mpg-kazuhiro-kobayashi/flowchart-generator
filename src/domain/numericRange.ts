/**
 * 数値範囲の操作に関するユーティリティ関数
 */

import { NumericOperator } from '@/types/flowchart';

/**
 * 数値範囲を表す型
 */
export interface NumericRange {
  /** 下限値（nullは負の無限大） */
  min: number | null;
  /** 下限を含むか */
  minInclusive: boolean;
  /** 上限値（nullは正の無限大） */
  max: number | null;
  /** 上限を含むか */
  maxInclusive: boolean;
}

/**
 * 演算子と値から数値範囲に変換
 */
export function operatorToRange(operator: NumericOperator, value: number): NumericRange {
  switch (operator) {
    case 'eq': // x = value
      return { min: value, minInclusive: true, max: value, maxInclusive: true };
    case 'gt': // x > value
      return { min: value, minInclusive: false, max: null, maxInclusive: false };
    case 'gte': // x >= value
      return { min: value, minInclusive: true, max: null, maxInclusive: false };
    case 'lt': // x < value
      return { min: null, minInclusive: false, max: value, maxInclusive: false };
    case 'lte': // x <= value
      return { min: null, minInclusive: false, max: value, maxInclusive: true };
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * 範囲を文字列で表現（デバッグ・表示用）
 */
export function rangeToString(range: NumericRange): string {
  const { min, minInclusive, max, maxInclusive } = range;

  // 点の場合（eq演算子）
  if (min !== null && max !== null && min === max && minInclusive && maxInclusive) {
    return `x = ${min}`;
  }

  // 下限のみ
  if (min !== null && max === null) {
    return minInclusive ? `x >= ${min}` : `x > ${min}`;
  }

  // 上限のみ
  if (min === null && max !== null) {
    return maxInclusive ? `x <= ${max}` : `x < ${max}`;
  }

  // 両方ある場合（区間）
  if (min !== null && max !== null) {
    const left = minInclusive ? `${min} <=` : `${min} <`;
    const right = maxInclusive ? `<= ${max}` : `< ${max}`;
    return `${left} x ${right}`;
  }

  // 全範囲
  return '全範囲';
}

/**
 * 範囲を下限値でソート（nullは最小として扱う）
 */
function sortRangesByMin(ranges: NumericRange[]): NumericRange[] {
  return [...ranges].sort((a, b) => {
    if (a.min === null && b.min === null) return 0;
    if (a.min === null) return -1;
    if (b.min === null) return 1;
    if (a.min !== b.min) return a.min - b.min;
    // 同じ値の場合、inclusiveを優先
    return a.minInclusive ? -1 : 1;
  });
}

/**
 * 2つの範囲が重複または隣接しているかチェック
 */
function rangesOverlapOrAdjacent(a: NumericRange, b: NumericRange): boolean {
  // aの上限とbの下限を比較
  if (a.max === null) return true; // aが無限大まで伸びている
  if (b.min === null) return true; // bが負の無限大から始まっている

  // 数値比較
  if (a.max > b.min) return true; // 明らかに重複
  if (a.max < b.min) return false; // 明らかにギャップ

  // a.max === b.min の場合
  // どちらかが境界を含んでいれば隣接（ギャップなし）
  return a.maxInclusive || b.minInclusive;
}

/**
 * 2つの範囲をマージ
 */
function mergeTwo(a: NumericRange, b: NumericRange): NumericRange {
  // 下限を決定
  let min: number | null;
  let minInclusive: boolean;
  if (a.min === null || b.min === null) {
    min = null;
    minInclusive = false;
  } else if (a.min < b.min) {
    min = a.min;
    minInclusive = a.minInclusive;
  } else if (a.min > b.min) {
    min = b.min;
    minInclusive = b.minInclusive;
  } else {
    min = a.min;
    minInclusive = a.minInclusive || b.minInclusive;
  }

  // 上限を決定
  let max: number | null;
  let maxInclusive: boolean;
  if (a.max === null || b.max === null) {
    max = null;
    maxInclusive = false;
  } else if (a.max > b.max) {
    max = a.max;
    maxInclusive = a.maxInclusive;
  } else if (a.max < b.max) {
    max = b.max;
    maxInclusive = b.maxInclusive;
  } else {
    max = a.max;
    maxInclusive = a.maxInclusive || b.maxInclusive;
  }

  return { min, minInclusive, max, maxInclusive };
}

/**
 * 重複・隣接する範囲をマージ
 */
function mergeOverlappingRanges(sortedRanges: NumericRange[]): NumericRange[] {
  if (sortedRanges.length === 0) return [];

  const merged: NumericRange[] = [sortedRanges[0]];

  for (let i = 1; i < sortedRanges.length; i++) {
    const current = sortedRanges[i];
    const last = merged[merged.length - 1];

    if (rangesOverlapOrAdjacent(last, current)) {
      // マージ
      merged[merged.length - 1] = mergeTwo(last, current);
    } else {
      // 新しい範囲として追加
      merged.push(current);
    }
  }

  return merged;
}

/**
 * マージ後の範囲からギャップを検出
 */
export function findNumericGaps(ranges: NumericRange[]): NumericRange[] {
  if (ranges.length === 0) {
    // 条件がない場合、全範囲がギャップ
    return [{ min: null, minInclusive: false, max: null, maxInclusive: false }];
  }

  const sorted = sortRangesByMin(ranges);
  const merged = mergeOverlappingRanges(sorted);
  const gaps: NumericRange[] = [];

  // 負の無限大から最初の範囲までのギャップ
  const first = merged[0];
  if (first.min !== null) {
    gaps.push({
      min: null,
      minInclusive: false,
      max: first.min,
      maxInclusive: !first.minInclusive,
    });
  }

  // 範囲間のギャップ
  for (let i = 0; i < merged.length - 1; i++) {
    const current = merged[i];
    const next = merged[i + 1];

    // currentの上限とnextの下限の間にギャップがあるか
    if (current.max !== null && next.min !== null) {
      // 既にマージ済みなので、ここにギャップがあるはず
      gaps.push({
        min: current.max,
        minInclusive: !current.maxInclusive,
        max: next.min,
        maxInclusive: !next.minInclusive,
      });
    }
  }

  // 最後の範囲から正の無限大までのギャップ
  const last = merged[merged.length - 1];
  if (last.max !== null) {
    gaps.push({
      min: last.max,
      minInclusive: !last.maxInclusive,
      max: null,
      maxInclusive: false,
    });
  }

  return gaps;
}
