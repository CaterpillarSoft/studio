import type { McapTypes } from '@mcap/core'

import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  Immutable,
  Initalization,
  IteratorResult,
  MessageEvent,
  MessageIteratorArgs,
} from './types'
import { BlobReadable } from './BlobReadable'
import { McapUnindexedIterableSource } from './McapUnindexedIterableSource'
import { RemoteFileReadable } from './util/RemoteFileReadable'

type McapSource = { type: 'file', file: Blob } | { type: 'url', url: string }

/**
 * Create a McapIndexedReader if it will be possible to do an indexed read. If the file is not
 * indexed or is empty, returns undefined.
 */
export async function tryCreateIndexedReader(readable: McapTypes.IReadable) {
  // const decompressHandlers = await loadDecompressHandlers()
  // try {
  //   const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers })

  //   if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0) {
  //     return undefined
  //   }
  //   return reader
  // }
  // catch (err) {
  //   console.error(err)
  //   return undefined
  // }

  console.log('readable', readable)
  return false
}

export class McapIterableSource implements IIterableSource {
  #source: McapSource
  #sourceImpl: IIterableSource | undefined

  public constructor(source: McapSource) {
    this.#source = source
  }

  public async initialize(): Promise<Initalization> {
    const source = this.#source

    switch (source.type) {
      case 'file': {
        // Ensure the file is readable before proceeding (will throw in the event of a permission
        // error). Workaround for the fact that `file.stream().getReader()` returns a generic
        // "network error" in the event of a permission error.
        await source.file.slice(0, 1).arrayBuffer()

        const readable = new BlobReadable(source.file)
        const reader = await tryCreateIndexedReader(readable)
        if (reader) {
          // this.#sourceImpl = new McapIndexedIterableSource(reader)
          // TODO 暂时只支持未索引的mcap文件
          this.#sourceImpl = new McapUnindexedIterableSource({
            size: source.file.size,
            stream: source.file.stream(),
          })
        }
        else {
          this.#sourceImpl = new McapUnindexedIterableSource({
            size: source.file.size,
            stream: source.file.stream(),
          })
        }
        break
      }
      case 'url': {
        const readable = new RemoteFileReadable(source.url)
        await readable.open()
        const reader = await tryCreateIndexedReader(readable)
        if (reader) {
          // this.#sourceImpl = new McapIndexedIterableSource(reader)
          const response = await fetch(source.url)
          if (!response.body) {
            throw new Error(`Unable to stream remote file. <${source.url}>`)
          }
          const size = response.headers.get('content-length')
          if (size == undefined) {
            throw new Error(`Remote file is missing Content-Length header. <${source.url}>`)
          }

          this.#sourceImpl = new McapUnindexedIterableSource({
            size: Number.parseInt(size),
            stream: response.body,
          })
        }
        else {
          const response = await fetch(source.url)
          if (!response.body) {
            throw new Error(`Unable to stream remote file. <${source.url}>`)
          }
          const size = response.headers.get('content-length')
          if (size == undefined) {
            throw new Error(`Remote file is missing Content-Length header. <${source.url}>`)
          }

          this.#sourceImpl = new McapUnindexedIterableSource({
            size: Number.parseInt(size),
            stream: response.body,
          })
        }
        break
      }
    }

    return await this.#sourceImpl.initialize()
  }

  public messageIterator(
    opt: Immutable<MessageIteratorArgs>,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this.#sourceImpl) {
      throw new Error('Invariant: uninitialized')
    }

    return this.#sourceImpl.messageIterator(opt)
  }

  public async getBackfillMessages(args: Immutable<GetBackfillMessagesArgs>): Promise<MessageEvent[]> {
    if (!this.#sourceImpl) {
      throw new Error('Invariant: uninitialized')
    }

    return await this.#sourceImpl.getBackfillMessages(args)
  }
}
