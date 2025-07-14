import type { Range } from './ranges'
import { simplify, substract, unify } from 'intervals-fn'
import { isRangeCoveredByRanges } from './ranges'

const kMaxLength = 2 ** 32

export default class VirtualLRUBuffer {
  public readonly byteLength: number // 这个buffer表示多少字节
  #blocks: Uint8Array[] = [] // 每个块的实际 Uint8Array
  #blockSize: number = Math.trunc(kMaxLength / 2) // 每个块的字节数
  #numberOfBlocks: number = Infinity // 任何时候允许的最大块数
  #lastAccessedBlockIndices: number[] = [] // 块的索引，从最少到最近访问
  #rangesWithData: Range[] = [] // 我们已复制数据的范围（未被淘汰）

  /**
   *
   * @param options
   * @param options.size - 文件大小
   * @param options.blockSize - 块大小
   * @param options.numberOfBlocks - 块数量
   */
  public constructor(options: {
    size: number
    blockSize?: number
    numberOfBlocks?: number
  }) {
    this.byteLength = options.size
    this.#blockSize = options.blockSize ?? this.#blockSize
    this.#numberOfBlocks = options.numberOfBlocks ?? this.#numberOfBlocks
  }

  /**
   * 检查 start（包含）到 end（不包含）之间的范围是否完全包含通过 copyFrom 复制的数据
   */
  public hasData(start: number, end: number): boolean {
    return isRangeCoveredByRanges({ start, end }, this.#rangesWithData)
  }

  /**
   * 获取 hasData 返回 true 的最小开始-结束对数组，按 start 排序
   */
  public getRangesWithData(): Range[] {
    return this.#rangesWithData
  }

  /**
   * 从 source buffer 复制数据到 VirtualLRUBuffer 的 targetStart 字节位置
   */
  public copyFrom(source: Uint8Array, targetStart: number): void {
    if (targetStart < 0 || targetStart >= this.byteLength) {
      throw new Error('VirtualLRUBuffer#copyFrom 输入无效')
    }

    const range = { start: targetStart, end: targetStart + source.byteLength }

    // 遍历块并复制数据。如果输入缓冲区太大，我们将淘汰最早复制的数据
    let position = range.start
    while (position < range.end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock }
        = this.#calculatePosition(position)
      this.#copy(source, this.#getBlock(blockIndex), positionInBlock, position - targetStart)
      position += remainingBytesInBlock
    }

    this.#rangesWithData = simplify(unify([range], this.#rangesWithData))
  }

  /**
   * 获取数据切片。如果 hasData(start, end) 为 false 则抛出错误
   * 如果所有数据恰好包含在一个块中，将使用高效的 slice 而不是复制
   */
  public slice(start: number, end: number): Uint8Array {
    const size = end - start
    if (start < 0 || end > this.byteLength || size <= 0 || size > kMaxLength) {
      throw new Error('VirtualLRUBuffer#slice 输入无效')
    }
    if (!this.hasData(start, end)) {
      throw new Error('VirtualLRUBuffer#slice 范围没有数据')
    }

    const startPositionData = this.#calculatePosition(start)
    if (size <= startPositionData.remainingBytesInBlock) {
      // 如果我们关心的整个范围都包含在一个块中，使用高效的 slice
      const { blockIndex, positionInBlock } = startPositionData
      return this.#getBlock(blockIndex).slice(positionInBlock, positionInBlock + size)
    }

    const result = new Uint8Array(size)
    let position = start
    while (position < end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock }
        = this.#calculatePosition(position)
      this.#copy(this.#getBlock(blockIndex), result, position - start, positionInBlock)
      position += remainingBytesInBlock
    }
    return result
  }

  /**
   * 获取块的引用，并标记为最近使用。可能会淘汰较旧的块
   */
  #getBlock(index: number): Uint8Array {
    if (!this.#blocks[index]) {
      // 如果块尚未分配，则分配
      let size = this.#blockSize
      if ((index + 1) * this.#blockSize > this.byteLength) {
        size = this.byteLength % this.#blockSize // 修剪最后一个块以匹配总大小
      }
      this.#blocks[index] = new Uint8Array(size)
    }

    // 将当前索引放到列表末尾，同时避免重复
    this.#lastAccessedBlockIndices = [
      ...this.#lastAccessedBlockIndices.filter(idx => idx !== index),
      index,
    ]

    if (this.#lastAccessedBlockIndices.length > this.#numberOfBlocks) {
      // 如果块太多，删除最近最少使用的块
      const deleteIndex = this.#lastAccessedBlockIndices.shift()
      if (deleteIndex !== undefined) {
        delete this.#blocks[deleteIndex]
        // 从 rangesWithData 中删除我们淘汰的范围
        this.#rangesWithData = simplify(
          substract(this.#rangesWithData, [
            { start: deleteIndex * this.#blockSize, end: (deleteIndex + 1) * this.#blockSize },
          ]),
        )
      }
    }

    const block = this.#blocks[index]
    if (!block) {
      throw new Error('不变量冲突 - 指定索引处不存在块')
    }
    return block
  }

  /**
   * 对于给定位置，计算 blockIndex、positionInBlock 和 remainingBytesInBlock
   */
  #calculatePosition(position: number) {
    if (position < 0 || position >= this.byteLength) {
      throw new Error('VirtualLRUBuffer#calculatePosition 输入无效')
    }
    const blockIndex = Math.floor(position / this.#blockSize)
    const positionInBlock = position - blockIndex * this.#blockSize
    const remainingBytesInBlock = this.#getBlock(blockIndex).byteLength - positionInBlock
    return { blockIndex, positionInBlock, remainingBytesInBlock }
  }

  /**
   * 复制 Uint8Array 的一部分到另一个 Uint8Array
   */
  #copy(
    source: Uint8Array,
    target: Uint8Array,
    targetStart: number,
    sourceStart: number,
    sourceEnd?: number,
  ): void {
    const count = (sourceEnd ?? source.byteLength) - sourceStart
    for (let i = 0; i < count; i++) {
      target[targetStart + i] = source[sourceStart + i]!
    }
  }
}
