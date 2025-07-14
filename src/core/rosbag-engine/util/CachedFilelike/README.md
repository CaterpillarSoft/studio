# CachedFilelike 测试说明

## 概述

本模块测试 `CachedFilelike` 类的功能，该类提供带缓存机制的文件接口，用于高效读取文件数据。

## 测试文件

- **测试文件**: `index.test.ts`
- **被测试文件**: `index.ts`
- **类型定义**: `types.ts`

## 运行测试

### 单独运行此模块测试
```bash
# 在项目根目录执行
pnpm test -- src/util/CachedFilelike
```

### 运行所有测试
```bash
pnpm test
```

## 测试覆盖功能

### 1. 构造函数测试
- ✅ 验证正确创建 `CachedFilelike` 实例
- ✅ 验证正确设置 `FileReader` 依赖

### 2. 文件打开 (`open`) 测试
- ✅ 成功打开文件并设置文件大小
- ✅ 处理文件无法打开的错误情况
- ✅ 验证方法的幂等性（可多次调用）

### 3. 文件大小 (`size`) 测试
- ✅ 文件未打开时抛出错误
- ✅ 文件打开后返回正确的大小

### 4. 数据读取 (`read`) 测试
- ✅ 处理零长度读取
- ✅ 输入无效时抛出错误（负数偏移量或长度）
- ✅ 读取超出文件大小时抛出错误
- ✅ 成功读取有效范围的数据
- ✅ 正确设置最后解析的回调结束位置

### 5. 边界条件测试
- ✅ 处理大文件的边界读取
- ✅ 正确处理文件末尾的读取

### 6. 缓存行为测试
- ✅ 跟踪连续读取操作
- ✅ 处理重叠的读取请求

## Mock 策略

测试使用了以下 Mock：
- `FileReader`: Mock 文件读取器接口，模拟 `open()` 和 `fetch()` 方法

## 核心接口

### FileReader 接口
```typescript
interface FileReader {
  open: () => Promise<{ size: number }>
  fetch: (offset: number, length: number) => FileStream
}
```

### Filelike 接口
```typescript
interface Filelike {
  read: (offset: number, length: number) => Promise<Uint8Array>
  size: () => number
}
```

## 注意事项

- 当前实现中的 `read` 方法返回空的 `Uint8Array`（待完善）
- 测试专注于验证接口约定和错误处理逻辑
- 缓存机制的具体实现有待进一步开发

## 示例用法

```typescript
import type { FileReader } from './types'
import CachedFilelike from './index'

// 创建文件读取器
const fileReader: FileReader = {
  open: () => Promise.resolve({ size: 1024 }),
  fetch: (offset, length) => mockStream
}

// 创建缓存文件实例
const cachedFile = new CachedFilelike({ fileReader })

// 打开文件
await cachedFile.open()

// 获取文件大小
const size = cachedFile.size()

// 读取数据
const data = await cachedFile.read(0, 100)
```
