import type { Time } from '@foxglove/rostime'
import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  IMessageCursor,
  Immutable,
  Initalization,
  IterableSourceInitializeArgs,
  IteratorResult,
  MessageEvent,
  MessageIteratorArgs,
} from './types'
import type { WorkerIterableSourceWorker } from './WorkerIterableSourceWorker'
import * as Comlink from 'comlink'

interface ConstructorArgs {
  initWorker: () => Worker
  initArgs: Immutable<IterableSourceInitializeArgs>
}

export class WorkerIterableSource implements IIterableSource {
  readonly #args: ConstructorArgs
  #sourceWorkerRemote?: Comlink.Remote<WorkerIterableSourceWorker>
  #disposeRemote?: () => void

  public constructor(args: ConstructorArgs) {
    this.#args = args
  }

  public async initialize(): Promise<Initalization> {
    this.#disposeRemote?.()

    const worker = this.#args.initWorker()

    const wrapped = Comlink.wrap<
      (args: Immutable<IterableSourceInitializeArgs>) => Comlink.Remote<WorkerIterableSourceWorker>
        >(worker)

    this.#disposeRemote = () => wrapped[Comlink.releaseProxy]()
    this.#sourceWorkerRemote = await wrapped(this.#args.initArgs)
    return await this.#sourceWorkerRemote.initialize()
  }

  public async* messageIterator(
    args: Immutable<MessageIteratorArgs>,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this.#sourceWorkerRemote === undefined) {
      throw new Error(`WorkerIterableSource is not initialized`)
    }

    const cursor = this.getMessageCursor(args)
    try {
      for (;;) {
        /**
         * 渲染的最快帧率是 60fps。因此要渲染一帧需要至少约 16 毫秒的消息才能渲染一帧。
         * 这里我们获取 17 毫秒的批次，这样一次批量获取可能会导致一帧渲染。
         * 在一批中获取太多意味着我们无法渲染，直到批次返回。
         */
        const results = await cursor.nextBatch(17 /** 毫秒 */)
        if (!results || results.length === 0) {
          break
        }
        yield* results
      }
    }
    finally {
      await cursor.end()
    }
  }

  public getMessageCursor(
    args: Immutable<MessageIteratorArgs> & { abort?: AbortSignal },
  ): IMessageCursor {
    if (this.#sourceWorkerRemote === undefined) {
      throw new Error('WorkerIterableSource is not initialized')
    }

    const { abort, ...rest } = args
    const messageCursorPromise = this.#sourceWorkerRemote.getMessageCursor(rest, abort)

    const cursor: IMessageCursor = {
      async next() {
        const messageCursor = await messageCursorPromise
        return await messageCursor.next()
      },

      async nextBatch(durationMs: number) {
        const messageCursor = await messageCursorPromise
        return await messageCursor.nextBatch(durationMs)
      },

      async readUntil(end: Time) {
        const messageCursor = await messageCursorPromise
        return await messageCursor.readUntil(end)
      },

      async end() {
        const messageCursor = await messageCursorPromise
        try {
          await messageCursor.end()
        }
        finally {
          messageCursor[Comlink.releaseProxy]()
        }
      },
    }

    return cursor
  }

  public async getBackfillMessages(
    args: Immutable<GetBackfillMessagesArgs>,
  ): Promise<MessageEvent[]> {
    if (this.#sourceWorkerRemote === undefined) {
      throw new Error('WorkerIterableSource is not initialized')
    }
    const { abortSignal, ...rest } = args
    return await this.#sourceWorkerRemote.getBackfillMessages(rest, abortSignal)
  }

  public async terminate(): Promise<void> {
    this.#disposeRemote?.()
    this.#disposeRemote = undefined
    this.#sourceWorkerRemote = undefined
  }
}
