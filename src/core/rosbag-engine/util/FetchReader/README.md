# FetchReader 测试说明

## 概述

本模块测试 `FetchReader` 类的功能，该类基于 `EventEmitter` 实现流式数据读取，提供基于事件的异步数据处理机制。

## 测试文件

- **测试文件**: `index.test.ts`
- **被测试文件**: `index.ts`
- **类型定义**: `types.ts`

## 运行测试

### 单独运行此模块测试
```bash
# 在项目根目录执行
pnpm test -- src/util/FetchReader
```

### 运行所有测试
```bash
pnpm test
```

## 测试覆盖功能

### 1. 实例创建测试
- ✅ 验证正确创建 `FetchReader` 实例
- ✅ 验证支持自定义请求选项（headers 等）
- ✅ 验证构造函数不抛出错误

### 2. 数据流读取测试
- ✅ 验证 `read()` 方法可以正常调用
- ✅ 基本的流式数据读取功能

### 3. 资源管理测试
- ✅ 验证 `destroy()` 方法正常工作
- ✅ 确保资源可以正确释放

## Mock 策略

测试使用了以下 Mock：
- `globalThis.fetch`: Mock 全局 fetch 函数
- Mock HTTP 响应对象和流读取器

## 核心事件类型

### EventTypes 接口
```typescript
interface EventTypes {
  data: (chunk: Uint8Array) => void
  end: () => void
  error: (err: Error) => void
}
```

### 事件流程
1. **data**: 每当接收到数据块时触发
2. **end**: 数据流结束时触发
3. **error**: 发生错误时触发

## 核心功能

### 流式数据处理
- 基于 `EventEmitter` 的异步事件系统
- 自动递归读取数据直到流结束
- 完善的错误处理和状态管理

### 资源管理
- 使用 `AbortController` 控制请求生命周期
- 提供 `destroy()` 方法主动释放资源
- 自动处理流关闭和错误情况

## 注意事项

- 测试保持简洁，专注于核心功能验证
- 使用 Mock 数据，避免实际网络请求
- 重点测试接口可用性和基本错误处理

## 示例用法

```typescript
import FetchReader from './index'

// 创建流读取器
const reader = new FetchReader('https://example.com/data.bag', {
  headers: {
    Range: 'bytes=0-1023'
  }
})

// 监听数据事件
reader.on('data', (chunk: Uint8Array) => {
  console.log('接收到数据:', chunk.length, '字节')
  // 处理数据块
  processDataChunk(chunk)
})

// 监听流结束事件
reader.on('end', () => {
  console.log('数据流读取完成')
  // 清理工作
  cleanup()
})

// 监听错误事件
reader.on('error', (error: Error) => {
  console.error('读取错误:', error.message)
  // 错误处理
  handleError(error)
})

// 开始读取
reader.read()

// 主动销毁（可选）
// reader.destroy()
```

## 使用场景

### 大文件分块读取
```typescript
const reader = new FetchReader(url, {
  headers: { Range: 'bytes=1000000-2000000' }
})

let totalBytes = 0
reader.on('data', (chunk) => {
  totalBytes += chunk.length
  console.log(`已读取 ${totalBytes} 字节`)
})
```

### 错误重试机制
```typescript
const reader = new FetchReader(url)
let retryCount = 0

reader.on('error', (error) => {
  if (retryCount < 3) {
    retryCount++
    console.log(`重试第 ${retryCount} 次`)
    setTimeout(() => reader.read(), 1000)
  }
  else {
    console.error('重试失败:', error)
  }
})
```

## 最佳实践

1. **始终监听 error 事件**: 确保错误得到妥善处理
2. **适时调用 destroy()**: 在不需要时主动释放资源
3. **合理设置超时**: 避免长时间等待无响应的请求
