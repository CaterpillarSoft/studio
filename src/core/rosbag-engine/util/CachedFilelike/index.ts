import type { Range } from './ranges'
import type { Filelike, FileReader, FileStream } from './types'
import { getNewConnection } from './getNewConnection'
import VirtualLRUBuffer from './VirtualLRUBuffer'

/**
 * 默认缓存大小
 * 缓存大小太小，会导致：
 * 缓存命中率降低
 * 频繁的网络请求
 */
const CACHE_BLOCK_SIZE = 1024 * 1024 * 100

/** 不开始新连接的距离（字节） */
const CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION = 1024 * 1024 * 5

/** 日志间隔（字节） */
const LOGGING_INTERVAL_IN_BYTES = 1024 * 1024 * 100 /** 每100MiB记录一次日志，避免日志过多 */

/**
 * CachedFilelike 提供了一个带缓存的文件类接口，用于高效读取文件数据
 *
 * 该类实现了一个缓存机制，使用 VirtualLRUBuffer 来减少冗余文件读取
 * 并提高文件对象的整体读取性能。
 *
 * @implements {Filelike}
 */
export default class CachedFilelike implements Filelike {
  /**
   * 负责实际文件数据检索的文件读取器
   * @private
   */
  #fileReader: FileReader

  /**
   * 文件的总大小（以字节为单位）
   * @private
   */
  #fileSize?: number

  /**
   * 缓存大小限制（字节） 当缓存大小 ≥ 文件大小时，不分片（性能最优）
   * @private
   */
  #cacheSizeInBytes: number = Infinity

  /**
   * 虚拟LRU缓冲区，用于数据缓存
   * @private
   */
  #virtualBuffer: VirtualLRUBuffer

  /**
   * 读取请求队列，包含范围、回调和请求时间
   * @private
   */
  #readRequests: Array<{
    range: { start: number, end: number }
    resolve: (data: Uint8Array) => void
    reject: (error: Error) => void
    requestTime: number
  }> = []

  /**
   * 上一次已解析读取请求的结束位置
   * 对潜在的预读优化很有用
   * @private
   */
  #lastResolvedCallbackEnd?: number

  /**
   * 重连回调
   * @private
   */
  #keepReconnectingCallback?: (reconnecting: boolean) => void

  /**
   * 上次错误时间
   * @private
   */
  #lastErrorTime?: number

  /**
   * 是否已关闭
   * @private
   */
  #closed: boolean = false

  /**
   * 当前连接
   * @private
   */
  #currentConnection: { stream: FileStream, remainingRange: Range } | undefined

  /**
   * 创建一个新的 CachedFilelike 实例
   *
   * @constructor
   * @param {object} options - 构造函数配置选项
   * @param {FileReader} options.fileReader - 用于读取文件的文件读取器
   * @param {number} [options.cacheSizeInBytes] - 缓存大小限制（字节）
   * @param {Function} [options.keepReconnectingCallback] - 重连回调
   */
  constructor(options: {
    fileReader: FileReader
    cacheSizeInBytes?: number
    keepReconnectingCallback?: (reconnecting: boolean) => void
  }) {
    this.#fileReader = options.fileReader
    this.#cacheSizeInBytes = options.cacheSizeInBytes ?? this.#cacheSizeInBytes
    this.#virtualBuffer = new VirtualLRUBuffer({ size: 0 })
    this.#keepReconnectingCallback = options.keepReconnectingCallback
  }

  /**
   * 打开文件并初始化文件元数据
   *
   * 此方法检索文件大小并为读取文件做准备。
   * 该方法是幂等的，可以安全地多次调用。
   *
   * @returns {Promise<void>} 一个在文件打开时解析的 Promise
   * @throws {Error} 如果打开文件时出现问题
   */
  public async open(): Promise<void> {
    if (this.#fileSize !== undefined) {
      return
    }

    const { size } = await this.#fileReader.open()
    this.#fileSize = size

    if (this.#cacheSizeInBytes >= size) {
      /** 如果缓存限制超过文件大小，则不需要限制为小块 */
      this.#virtualBuffer = new VirtualLRUBuffer({ size })
    }
    else {
      this.#virtualBuffer = new VirtualLRUBuffer({
        size,
        blockSize: CACHE_BLOCK_SIZE,
        /** 创建足够的块数，总是添加一个额外的块以允许读取范围不在块边界 */
        numberOfBlocks: Math.ceil(this.#cacheSizeInBytes / CACHE_BLOCK_SIZE) + 2,
      })
    }
  }

  /**
   * 检索文件的总大小（以字节为单位）
   *
   * @returns {number} 文件大小（字节）
   * @throws {Error} 如果文件尚未打开
   */
  public size(): number {
    if (!this.#fileSize) {
      throw new Error('CachedFilelike 尚未打开')
    }
    return this.#fileSize
  }

  /**
   * 从文件中读取指定范围的字节
   *
   * 此方法提供了一种异步读取文件特定部分的方式。
   * 处理了零长度读取和越界读取等边缘情况。
   * 使用缓存机制提高性能。
   *
   * @param {number} offset - 开始读取的字节位置
   * @param {number} length - 要读取的字节数
   * @returns {Promise<Uint8Array>} 解析为读取字节的 Promise
   * @throws {Error} 如果读取参数无效或超出文件大小
   */
  public read(offset: number, length: number): Promise<Uint8Array> {
    /** 处理零长度读取 */
    if (length === 0) {
      return Promise.resolve(new Uint8Array())
    }

    /** 定义读取范围 */
    const range = { start: offset, end: offset + length }

    /** 验证读取参数 */
    if (offset < 0 || length < 0) {
      return Promise.reject(new Error('CachedFilelike#read 输入无效'))
    }

    if (length > this.#cacheSizeInBytes) {
      return Promise.reject(new Error(`请求的数据超过缓存大小: ${length} > ${this.#cacheSizeInBytes}`))
    }

    return new Promise((resolve, reject) => {
      this.open()
        .then(() => {
          const size = this.size()

          /** 检查读取范围是否超出文件大小 */
          if (range.end > size) {
            reject(new Error('CachedFilelike#read 超出文件大小'))
            return
          }

          /** 添加到读取请求队列 */
          this.#readRequests.push({ range, resolve, reject, requestTime: Date.now() })
          this.#updateState()
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  #setConnection(range: Range): void {
    if (this.#currentConnection) {
      /** 如果存在当前连接，则销毁它 */
      const currentConnection = this.#currentConnection
      currentConnection.stream.destroy()
    }

    /** 启动流并更新当前连接状态 */
    const stream = this.#fileReader.fetch(range.start, range.end - range.start)
    this.#currentConnection = { stream, remainingRange: range }

    stream.on('error', (error: Error) => {
      const currentConnection = this.#currentConnection
      if (!currentConnection || stream !== currentConnection.stream) {
        return /** 忽略来自旧流的错误 */
      }

      if (this.#keepReconnectingCallback) {
        /** 如果设置了此回调，则继续重试 */
        if (this.#lastErrorTime === undefined) {
          /** 如果这是第一个错误，通知回调 */
          this.#keepReconnectingCallback(true)
        }
      }
      else {
        /**
         * 否则，如果在短时间内（100毫秒）收到两个错误，则可能存在严重错误，
         * 我们用错误解析所有剩余回调并关闭
         */
        const lastErrorTime = this.#lastErrorTime
        if (lastErrorTime !== undefined && Date.now() - lastErrorTime < 100) {
          this.#closed = true
          for (const request of this.#readRequests) {
            request.reject(error)
          }
          return
        }
      }

      this.#lastErrorTime = Date.now()
      currentConnection.stream.destroy()
      this.#currentConnection = undefined
      this.#updateState()
    })

    /** 处理数据流 */
    const startTime = Date.now()
    let bytesRead = 0
    let lastReportedBytesRead = 0

    stream.on('data', (chunk: Uint8Array) => {
      const currentConnection = this.#currentConnection
      if (!currentConnection || stream !== currentConnection.stream) {
        return /** 忽略来自旧流的数据 */
      }

      if (this.#lastErrorTime !== undefined) {
        /** 如果之前有错误，那么显然已经解决了，因为我们收到了一些数据 */
        this.#lastErrorTime = undefined
        if (this.#keepReconnectingCallback) {
          /** 如果我们有回调，让它知道问题已经解决 */
          this.#keepReconnectingCallback(false)
        }
      }

      /** 将数据复制到VirtualLRUBuffer中 */
      this.#virtualBuffer.copyFrom(chunk, currentConnection.remainingRange.start)
      bytesRead += chunk.byteLength

      /** 每隔一段时间，记录当前的下载速度 */
      if (bytesRead - lastReportedBytesRead > LOGGING_INTERVAL_IN_BYTES) {
        lastReportedBytesRead = bytesRead
        const sec = (Date.now() - startTime) / 1000

        console.log(`Connection @`, currentConnection.remainingRange, sec)
      }

      /** 检查请求的范围是否已完全下载 */
      if (this.#virtualBuffer.hasData(range.start, range.end)) {
        console.log(`连接完成! 范围: ${range.start}-${range.end}`)
        stream.destroy()
        this.#currentConnection = undefined
      }
      else {
        this.#currentConnection = {
          stream,
          remainingRange: { start: range.start + bytesRead, end: range.end },
        }
      }

      /** 始终调用`_updateState`，以便它可以决定创建新连接、解析回调等 */
      this.#updateState()
    })
  }

  /**
   * 更新状态，处理缓存命中和开始新的数据获取
   * @private
   */
  #updateState(): void {
    if (this.#closed) {
      return
    }

    /** 首先，检查是否有可以立即解析的读取请求（缓存命中） */
    this.#readRequests = this.#readRequests.filter(({ range, resolve }) => {
      if (!this.#virtualBuffer.hasData(range.start, range.end)) {
        return true /** 保留在队列中 */
      }

      /** 缓存命中，直接返回数据 */
      this.#lastResolvedCallbackEnd = range.end
      const buffer = this.#virtualBuffer.slice(range.start, range.end)

      resolve(buffer)
      return false /** 从队列中移除 */
    })

    const size = this.size()

    const newConnection = getNewConnection({
      /** 当前连接状态 */
      currentRemainingRange: this.#currentConnection
        ? this.#currentConnection.remainingRange
        : undefined,

      /** 用户需求 */
      readRequestRange: this.#readRequests[0] ? this.#readRequests[0].range : undefined,

      /** 已有资源 */
      downloadedRanges: this.#virtualBuffer.getRangesWithData(),

      /** 历史信息 */
      lastResolvedCallbackEnd: this.#lastResolvedCallbackEnd,

      /** 系统限制 */
      maxRequestSize: this.#cacheSizeInBytes,

      fileSize: size,

      continueDownloadingThreshold: CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION,
    })

    if (newConnection) {
      this.#setConnection(newConnection)
    }
  }
}
