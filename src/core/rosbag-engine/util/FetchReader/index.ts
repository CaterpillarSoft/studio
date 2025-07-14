import type { EventTypes } from './types'
import { EventEmitter } from 'eventemitter3'

/**
 * FetchReader类
 * 用于通过Fetch API读取数据流并通过事件发送数据
 * 继承EventEmitter以支持事件处理
 */
export default class FetchReader extends EventEmitter<EventTypes> {
  #response: Promise<Response>
  #reader?: ReadableStreamDefaultReader<Uint8Array>
  #controller: AbortController
  #aborted: boolean = false
  #url: string

  /**
   * 创建FetchReader实例
   * @param url 要获取的URL
   * @param options 可选的fetch请求选项
   */
  public constructor(url: string, options?: RequestInit) {
    super()
    this.#url = url
    this.#controller = new AbortController()
    this.#response = fetch(url, { ...options, signal: this.#controller.signal })
  }

  /**
   * 获取响应流的读取器
   * 你只能在响应体上调用一次getReader
   * 所以保留读取器的本地副本，并在第一次调用后返回它
   * @returns 流读取器或undefined（如果发生错误）
   * @private
   */
  async #getReader(): Promise<ReadableStreamDefaultReader<Uint8Array> | undefined> {
    if (this.#reader) {
      return this.#reader
    }
    let data: Response
    try {
      data = await this.#response
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(`GET <${this.#url}> failed: ${err}`)
      this.emit('error', error)
      return undefined
    }
    if (!data.ok) {
      const errMsg = data.statusText
      this.emit(
        'error',
        new Error(
          `GET <$${this.#url}> failed with status ${data.status}${errMsg ? ` (${errMsg})` : ``}`,
        ),
      )
      return undefined
    }

    if (!data.body) {
      this.emit('error', new Error(`GET <${this.#url}> succeeded, but returned no data`))
      return undefined
    }

    /** 获取成功，但流式传输仍可能出错 */
    try {
      /**
       * 当流关闭或出错时，它锁定的任何读取器都会被释放。
       * 如果在已经锁定的流上调用getReader方法，将会抛出异常。
       * 这通常由服务器端错误引起，但我们应该无论如何都捕获它。
       */
      this.#reader = data.body.getReader()
    }
    catch (err) {
      this.emit('error', new Error(`GET <${this.#url}> succeeded, but failed to stream: ${err}`))
      return undefined
    }

    return this.#reader
  }

  /**
   * 开始读取数据流
   * 读取完成后会触发'data'事件发送数据块
   * 读取结束会触发'end'事件
   * 出错会触发'error'事件
   */
  public read(): void {
    this.#getReader()
      .then((reader) => {
        /** 如果没有返回读取器，则表示我们遇到了错误 */
        if (!reader) {
          return
        }
        reader
          .read()
          .then(({ done, value }) => {
            /** 没有更多内容可读，表示流已结束 */
            if (done) {
              this.emit('end')
              return
            }
            this.emit('data', value)
            this.read()
          })
          .catch((unk) => {
            /** 取消xhr请求会导致promise拒绝 */
            if (this.#aborted) {
              this.emit('end')
              return
            }
            const err = unk instanceof Error ? unk : new Error(unk as string)
            this.emit('error', err)
          })
      })
      .catch((unk) => {
        const err = unk instanceof Error ? unk : new Error(unk as string)
        this.emit('error', err)
      })
  }

  /**
   * 销毁读取器并中止请求
   */
  public destroy(): void {
    this.#aborted = true
    this.#controller.abort()
  }
}
