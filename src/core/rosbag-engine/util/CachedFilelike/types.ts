export interface Filelike {
  read: (offset: number, length: number) => Promise<Uint8Array>
  size: () => number
}

/**
 * 文件流接口，用于异步读取文件数据
 * 提供数据监听、错误处理和流销毁功能
 */
export interface FileStream {
  /**
   * 监听文件流的数据事件
   * @template T 数据块的类型，通常是 Uint8Array
   * @param event 事件类型，'data' 表示接收到数据
   * @param listener 数据回调函数，接收每个数据块
   */
  on<T>(event: 'data', listener: (chunk: T) => void): void
  on(event: 'error', listener: (err: Error) => void): void
  /**
   * 销毁当前文件流
   * 用于中断文件读取、释放资源
   */
  destroy: () => void
}

/**
 * 文件读取器接口，提供文件基本读取能力
 * 支持打开文件和获取文件指定范围的数据流
 */
export interface FileReader {
  /**
   * 打开文件
   * @returns 包含文件大小的 Promise
   * @throws 如果文件无法打开，将抛出错误
   */
  open: () => Promise<{ size: number }>

  /**
   * 获取文件指定范围的数据流
   * @param offset 读取起始位置
   * @param length 读取长度
   * @returns 文件数据流 FileStream
   */
  fetch: (offset: number, length: number) => FileStream
}
