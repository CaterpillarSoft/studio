import type { IterableSourceInitializeArgs } from './types'
import * as Comlink from 'comlink'

import { McapIterableSource } from './McapIterableSource'
import { WorkerIterableSourceWorker } from './WorkerIterableSourceWorker'

export function initialize(args: IterableSourceInitializeArgs): WorkerIterableSourceWorker {
  if (args.file) {
    const source = new McapIterableSource({ type: 'file', file: args.file })
    const wrapped = new WorkerIterableSourceWorker(source)
    return Comlink.proxy(wrapped)
  }
  else if (args.url) {
    const source = new McapIterableSource({ type: 'url', url: args.url })
    const wrapped = new WorkerIterableSourceWorker(source)
    return Comlink.proxy(wrapped)
  }

  throw new Error('file or url required')
}

Comlink.expose(initialize)
