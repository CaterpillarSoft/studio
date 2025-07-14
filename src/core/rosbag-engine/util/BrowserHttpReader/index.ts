import type { FileReader, FileStream } from '../CachedFilelike/types'
import FetchReader from '../FetchReader'

/**
 * 浏览器HTTP读取器，实现FileReader接口
 * 用于通过HTTP请求读取远程文件
 */
export default class BrowserHttpReader implements FileReader {
  #url: string

  /**
   * 创建一个新的BrowserHttpReader实例
   * @param url 远程文件URL
   */
  public constructor(url: string) {
    this.#url = url
  }

  /**
   * 打开远程文件并获取其元数据
   * @returns 包含文件大小和可选标识符的对象
   * @throws 如果远程文件获取失败或不支持范围请求
   */
  public async open(): Promise<{ size: number, identifier?: string }> {
    let response: Response
    try {
      /**
       * 发起GET请求然后立即取消。这比HEAD请求更可靠，
       * 因为服务器可能不接受HEAD请求（例如，当使用仅适用于特定方法如GET的S3预签名URL时）。
       * 注意，我们不能使用`range: "bytes=0-1"`之类的，因为这样我们就无法获取实际的
       * 文件大小，除非将Content-Range设为CORS头，这样会使整个过程不那么可靠。
       */

      /**
       * "no-store"强制无条件远程请求。当浏览器的缓存已填充时，
       * 它可能会向请求添加`range`头，这会导致某些服务器在响应中省略
       * `accept-ranges`头。
       */
      const controller = new AbortController()
      response = await fetch(this.#url, { signal: controller.signal, cache: 'no-store' })
      controller.abort()
    }
    catch (error) {
      throw new Error(`Fetching remote file failed. ${error}`)
    }
    if (!response.ok) {
      throw new Error(
        `Fetching remote file failed. <${this.#url}> Status code: ${response.status}.`,
      )
    }
    if (response.headers.get('accept-ranges') !== 'bytes') {
      throw new Error(
        'Support for HTTP Range requests was not detected on the remote file.\n\nConfirm the resource has an \'Accept-Ranges: bytes\' header.',
      )
    }
    const size = response.headers.get('content-length')
    if (!size) {
      throw new Error(`Remote file is missing file size. <${this.#url}>`)
    }
    return {
      size: Number.parseInt(size),
      identifier:
        response.headers.get('etag') ?? response.headers.get('last-modified') ?? undefined,
    }
  }

  /**
   * 获取指定范围的文件数据
   * @param offset 起始字节偏移量
   * @param length 要读取的字节长度
   * @returns 文件流
   */
  public fetch(offset: number, length: number): FileStream {
    const headers = new Headers({ range: `bytes=${offset}-${offset + (length - 1)}` })
    const reader = new FetchReader(this.#url, { headers })
    reader.read()

    return reader
  }
}
