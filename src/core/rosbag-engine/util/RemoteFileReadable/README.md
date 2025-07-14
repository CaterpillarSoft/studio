# RemoteFileReadable 测试说明

## 概述

本模块测试 `RemoteFileReadable` 类的功能，该类提供远程文件读取的高级接口。

## 测试文件

- **测试文件**: `index.test.ts`
- **被测试文件**: `index.ts`

## 运行测试

### 单独运行此模块测试
```bash
# 在项目根目录执行
pnpm test -- src/util/RemoteFileReadable
```

### 运行所有测试
```bash
pnpm test
```

## 测试覆盖功能

### 1. 构造函数测试
- ✅ 验证正确创建 `RemoteFileReadable` 实例
- ✅ 验证依赖模块 `BrowserHttpReader` 和 `CachedFilelike` 的正确初始化

### 2. 文件打开 (`open`) 测试
- ✅ 成功打开远程文件
- ✅ 处理文件无法打开的错误情况

### 3. 文件大小 (`size`) 测试
- ✅ 正确返回文件大小的 BigInt 值
- ✅ 处理大文件大小（接近 `Number.MAX_SAFE_INTEGER`）

### 4. 数据读取 (`read`) 测试
- ✅ 成功读取指定范围的数据
- ✅ 处理读取范围过大的错误
- ✅ 处理偏移量过大的错误
- ✅ 正确处理零大小读取
- ✅ 传播底层读取错误

### 5. 边界条件测试
- ✅ 最大安全整数边界处理
- ✅ 零偏移量读取

## Mock 策略

测试使用了以下 Mock：
- `BrowserHttpReader`: Mock HTTP 读取器
- `CachedFilelike`: Mock 缓存文件接口

## 注意事项

- 所有测试使用 Mock 数据，不进行实际网络请求
- 测试专注于验证 API 接口和错误处理逻辑
- 使用 `vitest` 测试框架

## 示例用法

```typescript
import { RemoteFileReadable } from './index'

// 创建实例
const reader = new RemoteFileReadable('https://example.com/file.bag')

// 打开文件
await reader.open()

// 获取文件大小
const size = await reader.size()

// 读取数据
const data = await reader.read(0n, 1024n)
```
