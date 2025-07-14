import type { Time } from '@foxglove/rostime'
import type { IMessageCursor, IteratorResult } from './types'
import { add as addTime, compare } from '@foxglove/rostime'

/** 时间零点常量 */
const TIME_ZERO = Object.freeze({ sec: 0, nsec: 0 })

/**
 * IteratorCursor在AsyncIterable上实现IMessageCursor接口
 * 用于遍历和处理消息流
 */
class IteratorCursor implements IMessageCursor {
  #iter: AsyncIterableIterator<Readonly<IteratorResult>>
  /**
   * readUntil方法会读取迭代器直到包含结束时间。为了实现这一点，它会从迭代器读取
   * 直到收到一个接收时间晚于结束时间的消息，这表明它已经收到了包含结束时间的所有消息。
   * 由于迭代器只能读取一次，这个最后的结果必须存储起来供下一次readUntil调用使用，
   * 否则它将丢失。
   */
  #lastIteratorResult?: IteratorResult
  #abort?: AbortSignal

  /**
   * 创建IteratorCursor实例
   * @param iterator 异步可迭代的迭代器
   * @param abort 中止信号
   */
  public constructor(
    iterator: AsyncIterableIterator<Readonly<IteratorResult>>,
    abort?: AbortSignal,
  ) {
    this.#iter = iterator
    this.#abort = abort
  }

  /**
   * 获取下一个迭代结果
   * @returns 下一个迭代结果，如果没有更多结果则返回undefined
   */
  public async next(): ReturnType<IMessageCursor['next']> {
    if (this.#abort?.aborted === true) {
      return undefined
    }

    const result = await this.#iter.next()
    return result.value
  }

  /**
   * 获取下一批迭代结果，批量读取指定时间段内的消息
   * @param durationMs 持续时间（毫秒）
   * @returns 迭代结果数组，如果没有更多结果则返回undefined
   */
  public async nextBatch(durationMs: number): Promise<IteratorResult[] | undefined> {
    const firstResult = await this.next()
    if (!firstResult) {
      return undefined
    }

    if (firstResult.type === 'problem') {
      return [firstResult]
    }

    const results: IteratorResult[] = [firstResult]

    let cutoffTime: Time = TIME_ZERO
    switch (firstResult.type) {
      case 'stamp':
        cutoffTime = addTime(firstResult.stamp, { sec: 0, nsec: durationMs * 1e6 })
        break
      case 'message-event':
        cutoffTime = addTime(firstResult.msgEvent.receiveTime, { sec: 0, nsec: durationMs * 1e6 })
        break
    }

    for (;;) {
      const result = await this.next()
      if (!result) {
        return results
      }

      results.push(result)

      if (result.type === 'problem') {
        break
      }
      if (result.type === 'stamp' && compare(result.stamp, cutoffTime) > 0) {
        break
      }
      if (result.type === 'message-event' && compare(result.msgEvent.receiveTime, cutoffTime) > 0) {
        break
      }
    }
    return results
  }

  /**
   * 读取直到指定的结束时间
   * @param end 结束时间
   * @returns 迭代结果数组，如果被中止则返回undefined
   */
  public async readUntil(end: Time): ReturnType<IMessageCursor['readUntil']> {
    /**
     * 将值赋给变量以欺骗TypeScript控制流分析
     * TypeScript不理解这个值可能在await之后改变
     */
    const isAborted = this.#abort?.aborted
    if (isAborted === true) {
      return undefined
    }

    const results: IteratorResult[] = []

    /** 如果最后一个结果仍然超过结束时间，则返回空结果 */
    if (
      this.#lastIteratorResult?.type === 'stamp'
      && compare(this.#lastIteratorResult.stamp, end) >= 0
    ) {
      return results
    }

    if (
      this.#lastIteratorResult?.type === 'message-event'
      && compare(this.#lastIteratorResult.msgEvent.receiveTime, end) > 0
    ) {
      return results
    }

    if (this.#lastIteratorResult) {
      results.push(this.#lastIteratorResult)
      this.#lastIteratorResult = undefined
    }

    for (;;) {
      const result = await this.#iter.next()
      if (this.#abort?.aborted === true) {
        return undefined
      }

      if (result.done === true) {
        break
      }

      const value = result.value
      if (value.type === 'stamp' && compare(value.stamp, end) >= 0) {
        this.#lastIteratorResult = value
        break
      }
      if (value.type === 'message-event' && compare(value.msgEvent.receiveTime, end) > 0) {
        this.#lastIteratorResult = value
        break
      }
      results.push(value)
    }

    return results
  }

  /**
   * 结束迭代器
   * @returns Promise<void>
   */
  public async end(): ReturnType<IMessageCursor['end']> {
    await this.#iter.return?.()
  }
}

export { IteratorCursor }
