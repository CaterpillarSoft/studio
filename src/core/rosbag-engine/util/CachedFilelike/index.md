# CachedFilelike 文件缓存读取器

## 概述

`CachedFilelike` 是一个高级文件读取工具，专为大文件和网络文件读取场景设计，提供智能的内存缓存和分块读取机制。

## 主要特性

### 1. 智能缓存

- 支持有限和无限缓存模式
- 使用 LRU（最近最少使用）缓存策略
- 可配置缓存大小

### 2. 高效读取

- 支持分块读取文件
- 按需加载文件内容
- 预读取下一个可能需要的数据块

### 3. 错误处理

- 支持网络连接错误重试
- 可配置重连回调
- 处理不稳定网络环境

## 关键接口

### FileReader 接口

```typescript
interface FileReader {
  open: () => Promise<{ size: number }> // 打开文件并获取文件大小
  fetch: (offset: number, length: number) => FileStream // 获取特定范围的文件流
}
```

### 主要方法

- `open()`: 初始化文件读取
- `read(offset: number, length: number)`: 读取指定范围的文件内容
- `size()`: 获取文件总大小

## 使用示例

```typescript
const fileReader = new MyFileReader('large_file.bin')
const cachedFile = new CachedFilelike({
  fileReader,
  cacheSizeInBytes: 1024 * 1024 * 200, // 100MB 缓存
  keepReconnectingCallback: (reconnecting) => {
    // 处理重连状态
  },
})

// 读取文件部分内容
const data = await cachedFile.read(offset, length)
```

## 核心工作原理

1. 文件分块管理

   - 使用 `VirtualLRUBuffer` 管理内存缓存
   - 将文件划分为可管理的数据块
   - 智能决定下一个要下载的数据块

2. 连接管理

   - 使用 `getNewConnection` 函数决定是否建立新的文件读取连接
   - 避免重复下载已缓存的数据
   - 支持预读和顺序读取优化

3. 错误处理流程
   - 捕获文件读取错误
   - 支持自动重连
   - 提供重连状态回调

## 适用场景

- 大文件读取
- 网络文件流
- 需要部分加载的大型数据集
- 浏览器端文件处理

## 性能优化

- 最小化内存使用
- 减少不必要的文件读取
- 支持并发和预读
- 智能缓存管理

## 局限性

- 对于极小的文件，可能会有额外的性能开销
- 需要实现自定义的 `FileReader`
- 缓存大小需要谨慎配置

## 注意事项

1. 确保提供兼容的 `FileReader` 实现
2. 根据实际使用场景调整缓存大小
3. 处理可能的网络异常情况
