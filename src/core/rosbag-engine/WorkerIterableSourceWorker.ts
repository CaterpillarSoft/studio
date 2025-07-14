import type { TransferHandler } from 'comlink'
import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  IMessageCursor,
  Immutable,
  Initalization,
  IteratorResult,
  MessageEvent,
  MessageIteratorArgs,
} from './types'
import * as Comlink from 'comlink'

import { IteratorCursor } from './IteratorCursor'

/** 判断值是否为AbortSignal类型 */
const isAbortSignal = (val: unknown): val is AbortSignal => val instanceof AbortSignal

/**
 * AbortSignal的传输处理器
 * 用于在Worker边界之间传递中止信号
 */
const abortSignalTransferHandler: TransferHandler<AbortSignal, [boolean, MessagePort]> = {
  canHandle: isAbortSignal,
  deserialize: ([aborted, msgPort]) => {
    const controller = new AbortController()

    if (aborted) {
      controller.abort()
    }
    else {
      msgPort.onmessage = () => {
        controller.abort()
      }
    }

    return controller.signal
  },
  serialize: (abortSignal) => {
    const { port1, port2 } = new MessageChannel()
    abortSignal.addEventListener('abort', () => {
      port1.postMessage('aborted')
    })

    return [[abortSignal.aborted, port2], [port2]]
  },
}

/**
 * Worker可迭代源工作器类
 * 在Worker环境中实现IIterableSource接口
 */
export class WorkerIterableSourceWorker implements IIterableSource {
  /** 受保护的源实例 */
  protected _source: IIterableSource

  /**
   * 创建WorkerIterableSourceWorker实例
   * @param source 可迭代源实例
   */
  public constructor(source: IIterableSource) {
    this._source = source
  }

  /**
   * 初始化源
   * @returns 初始化结果
   */
  public async initialize(): Promise<Initalization> {
    return await this._source.initialize()
  }

  /**
   * 创建消息迭代器
   * @param args 消息迭代器参数
   * @returns 异步可迭代迭代器，标记为Comlink代理
   */
  public messageIterator(
    args: Immutable<MessageIteratorArgs>,
  ): AsyncIterableIterator<Readonly<IteratorResult>> & Comlink.ProxyMarked {
    return Comlink.proxy(this._source.messageIterator(args))
  }

  /**
   * 获取回填消息
   * @param args 回填消息参数（不包括中止信号）
   * @param abortSignal 中止信号（作为单独参数，以便通过comlink代理，因为AbortSignal不可克隆）
   * @returns 消息事件数组
   */
  public async getBackfillMessages(
    args: Immutable<Omit<GetBackfillMessagesArgs, 'abortSignal'>>,
    /** abortSignal作为单独参数，以便通过comlink代理，因为AbortSignal不可克隆（需要跨Worker边界发送信号） */
    abortSignal?: AbortSignal,
  ): Promise<MessageEvent[]> {
    return await this._source.getBackfillMessages({
      ...args,
      abortSignal,
    })
  }

  /**
   * 获取消息游标
   * @param args 消息迭代器参数（不包括中止参数）
   * @param abort 中止信号
   * @returns 消息游标，标记为Comlink代理
   */
  public getMessageCursor(
    args: Omit<Immutable<MessageIteratorArgs>, 'abort'>,
    abort?: AbortSignal,
  ): IMessageCursor & Comlink.ProxyMarked {
    const iter = this._source.messageIterator(args)
    const cursor = new IteratorCursor(iter, abort)
    return Comlink.proxy(cursor)
  }
}

/** 设置AbortSignal的Comlink传输处理器 */
Comlink.transferHandlers.set('abortsignal', abortSignalTransferHandler)
