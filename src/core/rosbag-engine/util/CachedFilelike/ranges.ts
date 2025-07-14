import { complement, intersect, isBefore, isDuring } from 'intervals-fn'

/** 范围接口，定义开始和结束位置 */
export interface Range { start: number, end: number }

/**
 * 检查查询范围是否被给定的范围数组覆盖
 * @param queryRange 要检查的查询范围
 * @param nonOverlappingMergedAndSortedRanges 不重叠、已合并且已排序的范围数组
 * @returns 如果查询范围被完全覆盖则返回true，否则返回false
 */
export function isRangeCoveredByRanges(
  queryRange: Range,
  nonOverlappingMergedAndSortedRanges: Range[],
): boolean {
  for (const range of nonOverlappingMergedAndSortedRanges) {
    if (isBefore(queryRange, range)) {
      return false
    }
    if (isDuring(queryRange, range)) {
      return true
    }
  }
  return false
}

/**
 * 计算在给定边界内，不被范围数组覆盖的缺失范围
 * @param bounds 边界范围
 * @param ranges 已有范围数组
 * @returns 缺失的范围数组
 */
export function missingRanges(bounds: Range, ranges: readonly Range[]): Range[] {
  /**
   * 当`ranges`中有超出`bounds`的范围时，`complement`函数的行为可能不符合预期，
   * 因此我们首先将`ranges`裁剪到`bounds`范围内。
   */
  return complement(bounds, intersect([bounds], ranges))
}
