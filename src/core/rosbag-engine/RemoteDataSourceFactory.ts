import type { IDataSourceFactory } from './IDataSourceFactory'
import { WorkerIterableSource } from './WorkerIterableSource'

// 浏览器兼容的 extname 实现
function extname(path: string): string {
  const lastDotIndex = path.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === path.length - 1) {
    return ''
  }
  return path.substring(lastDotIndex)
}

interface DataSourceFactoryInitializeArgs {
  file?: File
  files?: File[]
  params?: Record<string, string | undefined>
}

/** 初始化 worker */
const initWorkers: Record<string, () => Worker> = {
  '.bag': () => {
    return new Worker(
      new URL('./BagIterableSourceWorker.worker', import.meta.url),
      { type: 'module' },
    )
  },
  '.mcap': () => {
    return new Worker(
      new URL('./McapIterableSourceWorker.worker', import.meta.url),
      { type: 'module' },
    )
  },
}

export class RemoteDataSourceFactory implements IDataSourceFactory {
  public initialize(args: DataSourceFactoryInitializeArgs) {
    const url = args.params?.url
    if (!url) {
      throw new Error('Missing url argument')
    }

    const extension = extname(new URL(url).pathname)
    const initWorker = initWorkers[extension]
    if (!initWorker) {
      throw new Error(`不支持的文件类型: ${extension}`)
    }

    const source = new WorkerIterableSource({ initWorker, initArgs: { url } })

    return source
  }
}
