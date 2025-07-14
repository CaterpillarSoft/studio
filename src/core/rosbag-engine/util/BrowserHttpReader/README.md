# BrowserHttpReader 测试说明

## 概述

本模块测试 `BrowserHttpReader` 类的功能，该类实现基于浏览器 `fetch` API 的 HTTP Range 请求，用于精确读取远程文件的指定字节范围。

## 测试文件

- **测试文件**: `index.test.ts`
- **被测试文件**: `index.ts`

## 运行测试

### 单独运行此模块测试
```bash
# 在项目根目录执行
pnpm test -- src/util/BrowserHttpReader
```

### 运行所有测试
```bash
pnpm test
```

## 测试覆盖功能

### 1. 构造函数测试
- ✅ 验证正确创建 `BrowserHttpReader` 实例
- ✅ 验证正确设置目标 URL

### 2. 文件打开 (`open`) 测试
- ✅ 成功打开支持 Range 请求的文件
- ✅ 处理网络请求失败
- ✅ 处理 HTTP 响应状态错误（如 404）
- ✅ 处理不支持 Range 请求的服务器
- ✅ 处理缺少文件大小信息的响应
- ✅ 正确处理不同标识符来源（ETag、Last-Modified）
- ✅ 处理没有标识符的情况

### 3. 数据获取 (`fetch`) 测试
- ✅ 创建正确的 Range 请求并返回 FetchReader
- ✅ 为不同的偏移量和长度创建不同的请求
- ✅ 正确计算 Range 头部

### 4. 边界条件测试
- ✅ 处理零偏移量的读取
- ✅ 处理大偏移量的读取
- ✅ 处理单字节读取

### 5. 错误处理测试
- ✅ 正确处理网络超时
- ✅ 正确处理无效的响应头

## Mock 策略

测试使用了以下 Mock：
- `globalThis.fetch`: Mock 全局 fetch 函数
- Mock HTTP 响应对象，包括 headers 和状态

## 核心功能

### Range 请求支持
- 自动检测服务器是否支持 `Accept-Ranges: bytes`
- 生成正确的 `Range: bytes=start-end` 头部
- 处理各种 HTTP 状态码和错误情况

### 文件标识符
支持多种文件标识符来源：
1. **ETag**: 优先使用 ETag 作为文件标识符
2. **Last-Modified**: 备选使用最后修改时间
3. **undefined**: 无标识符时返回 undefined

## 注意事项

- 使用 GET 请求配合 AbortController 来检测服务器能力，比 HEAD 请求更兼容
- 使用 `cache: 'no-store'` 避免浏览器缓存干扰
- 严格验证服务器对 Range 请求的支持

## 示例用法

```typescript
import BrowserHttpReader from './index'

// 创建 HTTP 读取器
const reader = new BrowserHttpReader('https://example.com/file.bag')

// 打开文件，获取基本信息
const { size, identifier } = await reader.open()
console.log(`文件大小: ${size} 字节`)
console.log(`文件标识符: ${identifier}`)

// 获取指定范围的数据流
const stream = reader.fetch(0, 1024) // 读取前 1024 字节

// 监听数据流
stream.on('data', (chunk) => {
  console.log('接收到数据块:', chunk)
})

stream.on('end', () => {
  console.log('数据读取完成')
})

stream.on('error', (error) => {
  console.error('读取错误:', error)
})
```

## HTTP Range 请求示例

```http
# 请求前 1024 字节
GET /file.bag HTTP/1.1
Range: bytes=0-1023
Cache-Control: no-store

# 请求 1024-2047 字节
GET /file.bag HTTP/1.1
Range: bytes=1024-2047
Cache-Control: no-store
```
