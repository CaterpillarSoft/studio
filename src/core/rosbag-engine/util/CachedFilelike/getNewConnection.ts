import type { Range } from './ranges'
import { isOverlapping } from 'intervals-fn'
import { isRangeCoveredByRanges, missingRanges } from './ranges'

/**
 * 基于多个属性，此函数确定是否应该打开新连接。
 * 它可用于任何类型的范围，无论是字节、时间戳还是其他内容。
 * @param options
 * @param options.currentRemainingRange 当前连接（如果有）将要下载的剩余范围
 * @param options.readRequestRange 我们试图满足的读取请求的范围
 * @param options.downloadedRanges 已下载范围的数组
 * @param options.lastResolvedCallbackEnd 我们解析的最后一个读取请求的range.end。对于预读很有用
 * @param options.maxRequestSize 缓存大小。如果等于或大于`fileSize`，我们将尝试下载整个文件
 * @param options.fileSize 文件大小
 * @param options.continueDownloadingThreshold 在打开新连接之前我们愿意等待下载的数量
 */
export function getNewConnection(options: {
  /** 当前连接（如果有）将要下载的剩余范围 */
  currentRemainingRange?: Range
  /** 我们试图满足的读取请求的范围 */
  readRequestRange?: Range
  /** 已下载范围的数组 */
  downloadedRanges: Range[]
  /** 我们解析的最后一个读取请求的range.end。对于预读很有用 */
  lastResolvedCallbackEnd?: number
  /** 缓存大小。如果等于或大于`fileSize`，我们将尝试下载整个文件 */
  maxRequestSize: number
  /** 文件大小 */
  fileSize: number
  /** 在打开新连接之前我们愿意等待下载的数量 */
  continueDownloadingThreshold: number
}): Range | undefined {
  const { readRequestRange, currentRemainingRange, ...otherOptions } = options
  if (readRequestRange) {
    return getNewConnectionWithExistingReadRequest({
      readRequestRange,
      currentRemainingRange,
      ...otherOptions,
    })
  }
  else if (!currentRemainingRange) {
    return getNewConnectionWithoutExistingConnection(otherOptions)
  }
  return undefined
}
/**
 * 当有一个请求的范围，我们正在尝试下载时，此函数确定是否应该打开新连接。
 * @param options
 * @param options.currentRemainingRange 当前连接（如果有）将要下载的剩余范围
 * @param options.readRequestRange 我们试图满足的读取请求的范围
 * @param options.downloadedRanges 已下载范围的数组
 * @param options.maxRequestSize 缓存大小。如果等于或大于`fileSize`，我们将尝试下载整个文件
 * @param options.fileSize 文件大小
 * @param options.continueDownloadingThreshold 在打开新连接之前我们愿意等待下载的数量
 * @param options.lastResolvedCallbackEnd 我们解析的最后一个读取请求的range.end。对于预读很有用
 * @returns
 */
function getNewConnectionWithExistingReadRequest({
  currentRemainingRange,
  readRequestRange,
  downloadedRanges,
  maxRequestSize,
  fileSize,
  continueDownloadingThreshold,
}: {
  currentRemainingRange?: Range
  readRequestRange: Range
  downloadedRanges: Range[]
  lastResolvedCallbackEnd?: number
  maxRequestSize: number
  fileSize: number
  continueDownloadingThreshold: number
}): Range | undefined {
  /** 我们有一个请求的范围，我们正在尝试下载 */
  if (readRequestRange.end - readRequestRange.start > maxRequestSize) {
    /** 这应该在更早的时候就被捕获，但这里作为一个健全性检查 */
    throw new Error(
      `Range ${readRequestRange.start}-${readRequestRange.end} exceeds max request size ${maxRequestSize} (file size ${fileSize})`,
    )
  }

  /** 获取尚未下载的请求范围的部分 */
  const notDownloadedRanges = missingRanges(readRequestRange, downloadedRanges)

  if (!notDownloadedRanges[0]) {
    /** 如果没有，那么我们不应该传入`readRequestRange` */
    throw new Error(
      'Range for the first read request is fully downloaded, so it should have been deleted',
    )
  }

  /** 我们想要启动一个新连接，如果： */
  const startNewConnection /** 1. 没有当前连接 */
    = !currentRemainingRange /** 2. 或者当前连接和请求范围之间没有重叠 */
      || !isOverlapping(notDownloadedRanges, [currentRemainingRange]) /** 3. 或者我们将在某个时候到达请求范围，但那需要太长时间 */
      || currentRemainingRange.start + continueDownloadingThreshold < notDownloadedRanges[0].start

  if (!startNewConnection) {
    return
  }
  if (maxRequestSize >= fileSize) {
    /** 如果我们尝试下载整个文件，一直读取到我们已经下载的下一个范围 */
    const range = { start: notDownloadedRanges[0].start, end: fileSize }
    return missingRanges(range, downloadedRanges)[0]
  }

  if (notDownloadedRanges[0].end === readRequestRange.end) {
    /**
     * 如果我们正在下载到我们范围的末尾，同时进行一些预读
     * 注意，我们可能已经下载了这个范围的部分，但我们不知道它们何时被驱逐，
     * 所以现在我们只是再次下载整个范围
     */
    return {
      ...notDownloadedRanges[0],
      end: Math.min(readRequestRange.start + maxRequestSize, fileSize),
    }
  }

  /** 否则，从第一个未下载的范围开始读取 */
  return notDownloadedRanges[0]
}

/**
 * 当没有请求的范围，我们正在尝试下载时，此函数确定是否应该打开新连接。
 * @param options
 * @param options.downloadedRanges 已下载范围的数组
 * @param options.lastResolvedCallbackEnd 我们解析的最后一个读取请求的range.end。对于预读很有用
 * @param options.maxRequestSize 缓存大小。如果等于或大于`fileSize`，我们将尝试下载整个文件
 * @param options.fileSize 文件大小
 * @returns
 */
function getNewConnectionWithoutExistingConnection({
  downloadedRanges,
  lastResolvedCallbackEnd,
  maxRequestSize,
  fileSize,
}: {
  downloadedRanges: Range[]
  lastResolvedCallbackEnd?: number
  maxRequestSize: number
  fileSize: number
}): Range | undefined {
  /** 如果我们没有任何读取请求，并且我们也没有活动连接，那么开始预读尽可能多的数据！ */
  let readAheadRange: Range | undefined
  if (maxRequestSize >= fileSize) {
    /** 如果我们有无限缓存，我们想要读取整个文件，但仍然优先在最后一个请求发生的地方附近下载 */
    const potentialRange = { start: lastResolvedCallbackEnd ?? 0, end: fileSize }
    if (!isRangeCoveredByRanges(potentialRange, downloadedRanges)) {
      readAheadRange = potentialRange
    }
    else {
      readAheadRange = { start: 0, end: fileSize }
    }
  }
  else if (lastResolvedCallbackEnd !== undefined) {
    /**
     * 否则，如果我们有有限的缓存，我们想要读取最后一个读取请求之后的数据，
     * 因为通常读取请求是连续的，没有间隙
     */
    readAheadRange = {
      start: lastResolvedCallbackEnd,
      end: Math.min(lastResolvedCallbackEnd + maxRequestSize, fileSize),
    }
  }
  if (readAheadRange) {
    /** 如果我们有一个想要预读的范围，那么为其中尚未下载的范围创建一个新连接 */
    return missingRanges(readAheadRange, downloadedRanges)[0]
  }
  return undefined
}
