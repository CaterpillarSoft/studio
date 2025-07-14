import BrowserHttpReader from '../BrowserHttpReader'
import CachedFilelike from '../CachedFilelike'

/** 用于mcap IterableSource接口的实现 */
export class RemoteFileReadable {
  #remoteReader: CachedFilelike

  /**
   * 创建RemoteFileReadable实例
   * @param url 远程文件的URL
   */
  public constructor(url: string) {
    const fileReader = new BrowserHttpReader(url)
    this.#remoteReader = new CachedFilelike({
      fileReader,
      cacheSizeInBytes: 1024 * 1024 * 200, /** 200MiB缓存大小 */
    })
  }

  /**
   * 打开远程文件
   * @returns Promise<void>
   * @throws 如果文件无法读取则抛出错误
   */
  public async open(): Promise<void> {
    await this.#remoteReader.open() /** 重要：我们首先调用此方法，因为如果文件无法读取，它可能会抛出错误 */
  }

  /**
   * 获取文件大小
   * @returns 文件大小（以字节为单位）
   */
  public async size(): Promise<bigint> {
    return BigInt(this.#remoteReader.size())
  }

  /**
   * 从指定偏移量读取指定大小的数据
   * @param offset 起始偏移量
   * @param size 要读取的字节数
   * @returns 包含读取数据的Uint8Array
   * @throws 如果读取范围过大则抛出错误
   */
  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset + size > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Read too large: offset ${offset}, size ${size}`)
    }
    return await this.#remoteReader.read(Number(offset), Number(size))
  }
}
