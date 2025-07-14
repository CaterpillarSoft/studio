import type { MessageDefinition, MessageDefinitionField } from '@foxglove/message-definition'
import type { Time } from '@foxglove/rostime'

/**
 * Extend the standard ROS message definition with an optional flag.
 */
type OptionalMessageDefinitionField = MessageDefinitionField & { optional?: boolean }

export type OptionalMessageDefinition = MessageDefinition & {
  definitions: OptionalMessageDefinitionField[]
}

/** RosDatatypes is a map of datatype name to the datatype definition */
export type RosDatatypes = Map<string, OptionalMessageDefinition>
export interface MessageEvent<T = unknown> {
  /** 此消息接收的主题名称，例如 "/some/topic" */
  topic: string
  /**
   * schema名称是消息事件中消息模式的标识符。
   */
  schemaName: string
  /**
   * 接收此消息的时间（纳秒）。这可能由本地系统时钟或数据源设置，
   * 取决于使用的数据源以及时间是否通过 /clock 主题或类似机制进行模拟。
   * 时间戳通常是自UNIX纪元以来的纳秒数，但根据上下文，
   * 也可能相对于另一个事件，如系统启动时间或模拟开始时间。
   */
  receiveTime: Time
  /**
   * 此消息最初发布的时间（纳秒）。这仅适用于某些数据源。
   * 时间戳通常是自UNIX纪元以来的纳秒数，但根据上下文，
   * 也可能相对于另一个事件，如系统启动时间或模拟开始时间。
   */
  publishTime?: Time
  /** 作为JavaScript对象的反序列化消息。 */
  message: T
  /**
   * 此消息在序列化形式中的近似大小。
   * 这对于统计跟踪和缓存清除很有用。
   */
  sizeInBytes: number

  /**
   * 当使用`convertTo`选项订阅主题时，消息事件的`message`
   * 包含转换后的消息，而originalMessageEvent字段包含原始
   * 未转换的消息事件。
   */
  originalMessageEvent?: MessageEvent
}

export interface TopicStats {
  // The number of messages observed on the topic.
  numMessages: number
  // Timestamp of the first observed message on this topic. Only set for static data sources such as
  // local files or servers that provide a fixed set of data.
  firstMessageTime?: Time
  // Timestamp of the last observed message on this topic. Only set for static data sources such as
  // local files or servers that provide a fixed set of data.
  lastMessageTime?: Time
}

export interface Topic {
  name: string
  schemaName?: string
}

export interface Connection {
  conn: number
  topic: string
  md5sum?: string
  messageDefinition?: string
  type?: string
  callerid?: string
}

export interface DecompressHandlers {
  bz2?: (buffer: Uint8Array, size: number) => Uint8Array
  lz4?: (buffer: Uint8Array, size: number) => Uint8Array
}

export interface ParseOptions {
  parse?: boolean
  decompress?: DecompressHandlers
}

// 数据源输入类型
export type DataSourceInput
  = { type: 'file', file: File | Blob }
    | { type: 'url', url: string }
    | { type: 'stream', stream: ReadableStream, size?: number }

// 初始化结果
export interface Initalization {
  start: Time
  end: Time
  topics: Topic[]
}

/**
 * 主题订阅配置
 * 定义了需要订阅的主题及其预加载策略
 */
export interface SubscribePayload {
  /** 主题名称，对应ROSBag中的topic */
  topic: string

  /**
   * 预加载类型（可选）
   * - full: 完全预加载该主题的所有消息
   * - partial: 部分预加载，按需加载消息
   */
  preloadType?: 'full' | 'partial'
}

export type TopicSelection = Map<string, SubscribePayload>

// 消息迭代器参数
export interface MessageIteratorArgs {
  topics: TopicSelection
  start?: Time
  end?: Time
  reverse?: boolean
  consumptionType?: 'full' | 'partial'
}

// 获取回填消息的参数
export interface GetBackfillMessagesArgs {
  topics: TopicSelection
  time: Time

  abortSignal?: AbortSignal
}

export type NotificationSeverity = 'error' | 'warn' | 'info'

interface PlayerProblem {
  severity: NotificationSeverity
  message: string
  error?: Error
  tip?: string
}

// 迭代器结果
export type IteratorResult
  = | {
    type: 'message-event'
    msgEvent: MessageEvent
  }
  | {
    type: 'problem'
    /**
     * 表示问题来源的通道/连接的ID。应用程序可能选择
     * 仅显示每个连接的单个问题，以避免使用户不知所措。
     */
    connectionId: number
    problem: PlayerProblem
  }
  | {
    type: 'stamp'
    stamp: Time
  }

export interface IMessageCursor {
  /**
   * 从游标读取下一条消息。返回结果或undefined（如果游标已完成）
   */
  next: () => Promise<IteratorResult | undefined>

  /**
   * 从游标读取下一批消息。返回结果数组或undefined（如果游标已完成）。
   *
   * @param durationMs 指示批处理停止等待更多消息并返回的持续时间（毫秒）。
   * 此持续时间跟踪批处理中第一条消息的接收时间。
   */
  nextBatch: (durationMs: number) => Promise<IteratorResult[] | undefined>

  /**
   * 读取到结束时间（包含）或游标结束的一批消息
   *
   * 当游标中没有更多消息时返回undefined
   */
  readUntil: (end: Time) => Promise<IteratorResult[] | undefined>

  /**
   * 结束游标
   *
   * 释放游标持有的任何资源。
   *
   * 在游标结束后，对next()和readUntil()的调用应返回`undefined`，
   * 就像游标已到达其消息末尾一样。
   */
  end: () => Promise<void>
}

export type IsAny<Type> = 0 extends 1 & Type ? true : false
export type Primitive = string | number | boolean | bigint | symbol | undefined | null
export type AnyArray<Type = any> = Array<Type> | ReadonlyArray<Type>
export type Builtin = Primitive | Function | Date | Error | RegExp
export type IsTuple<Type> = Type extends readonly any[]
  ? any[] extends Type
    ? never
    : Type
  : never
export type IsUnknown<Type> = IsAny<Type> extends true
  ? false
  : unknown extends Type
    ? true
    : false

// Immutable 类型辅助
export type Immutable<Type> = Type extends Exclude<Builtin, Error>
  ? Type
  : Type extends Map<infer Keys, infer Values>
    ? ReadonlyMap<Immutable<Keys>, Immutable<Values>>
    : Type extends ReadonlyMap<infer Keys, infer Values>
      ? ReadonlyMap<Immutable<Keys>, Immutable<Values>>
      : Type extends WeakMap<infer Keys, infer Values>
        ? WeakMap<Immutable<Keys>, Immutable<Values>>
        : Type extends Set<infer Values>
          ? ReadonlySet<Immutable<Values>>
          : Type extends ReadonlySet<infer Values>
            ? ReadonlySet<Immutable<Values>>
            : Type extends WeakSet<infer Values>
              ? WeakSet<Immutable<Values>>
              : Type extends Promise<infer Value>
                ? Promise<Immutable<Value>>
                : Type extends AnyArray<infer Values>
                  ? Type extends IsTuple<Type>
                    ? { readonly [Key in keyof Type]: Immutable<Type[Key]> }
                    : ReadonlyArray<Immutable<Values>>
                  : Type extends object
                    ? { readonly [Key in keyof Type]: Immutable<Type[Key]> }
                    : IsUnknown<Type> extends true
                      ? unknown
                      : Readonly<Type>

/**
 * 可迭代数据源接口
 * 用于处理不同类型的数据源（文件、URL、流等）并提供统一的消息访问接口
 */
export interface IIterableSource {
  /**
   * 初始化数据源
   * @returns 返回包含开始时间、结束时间、主题列表、连接信息等的初始化结果
   */
  initialize: () => Promise<Initalization>

  /**
   * 创建消息迭代器
   * @param args 迭代参数，包括主题过滤、时间范围、是否反向等配置
   * @returns 异步迭代器，用于逐个获取消息事件、问题报告或时间戳
   */
  messageIterator: (
    args: Immutable<MessageIteratorArgs>,
  ) => AsyncIterableIterator<Readonly<IteratorResult>>

  /**
   * 获取回填消息
   * 用于获取指定时间点之前的最新消息，通常用于初始化状态
   * @param args 包含主题列表、时间点和可选的取消信号
   * @returns 返回匹配条件的消息事件数组
   */
  getBackfillMessages: (args: Immutable<GetBackfillMessagesArgs>) => Promise<MessageEvent[]>

  /**
   * 获取消息游标（可选）
   * 提供更灵活的消息读取方式，支持批量读取和精确控制
   * @param args 迭代参数，包括可选的取消信号
   * @returns 消息游标对象，支持 next()、nextBatch() 等方法
   */
  getMessageCursor?: (
    args: Immutable<MessageIteratorArgs> & { abort?: AbortSignal },
  ) => IMessageCursor

  /**
   * 终止数据源（可选）
   * 清理资源并关闭连接，确保优雅地结束数据源操作
   */
  terminate?: () => Promise<void>
}

export interface IterableSourceInitializeArgs {
  file?: File
  url?: string
  files?: File[]
  params?: Record<string, string | undefined>

  api?: {
    baseUrl: string
    auth?: string
  }
}

export interface DataSourceFactoryInitializeArgs {
  file?: File
  files?: File[]
  params?: Record<string, string | undefined>
}
