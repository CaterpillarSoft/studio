import type { DataSourceFactoryInitializeArgs } from './types'
import type { WorkerIterableSource } from './WorkerIterableSource'

/**
 * 数据源工厂接口
 * 用于创建和初始化数据源
 */
export interface IDataSourceFactory {
  /**
   * 初始化数据源
   * @param args 初始化参数
   * @returns 工作线程可迭代数据源
   */
  initialize: (args: DataSourceFactoryInitializeArgs) => WorkerIterableSource
}
