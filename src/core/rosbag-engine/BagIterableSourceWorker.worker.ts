import type { IterableSourceInitializeArgs } from './types'
import * as Comlink from 'comlink'

import { BagIterableSource } from './BagIterableSource'
import { WorkerIterableSourceWorker } from './WorkerIterableSourceWorker'

export function initialize(
  args: IterableSourceInitializeArgs,
): WorkerIterableSourceWorker {
  if (args.file) {
    const source = new BagIterableSource({ type: 'file', file: args.file })
    const wrapped = new WorkerIterableSourceWorker(source)
    return Comlink.proxy(wrapped)
  }
  else if (args.url) {
    const source = new BagIterableSource({ type: 'url', url: args.url })
    const wrapped = new WorkerIterableSourceWorker(source)
    return Comlink.proxy(wrapped)
  }

  throw new Error('file or url required')
}

Comlink.expose(initialize)
