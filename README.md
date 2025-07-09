# @caterpillarsoft/studio

@caterpillarsoft/studio is a purpose-built platform that empowers robotics teams to visually debug robots, build reliable autonomy, and scale their development.

## 平台设计思路

### 核心理念

@caterpillarsoft/studio 是一个可灵活扩展的平台，旨在提供解析特殊格式并播放的基础能力，同时采用现代插件架构，使开发者能够轻松扩展平台功能。平台的设计遵循以下核心理念：

- **可扩展性优先**：平台核心保持精简，主要功能通过插件实现
- **声明式贡献点**：通过清晰的贡献点（Contribution Points）机制扩展平台
- **隔离与安全**：插件在受控环境中运行，确保平台稳定性和安全性

### 插件系统概述

#### 基本架构

平台采用先进的插件架构，主要包含以下组件：

1. **插件宿主**：提供插件运行环境和生命周期管理
2. **插件清单**：通过 JSON 格式的清单文件声明插件的能力
3. **扩展 API**：提供丰富的 API 供插件调用平台功能

#### 核心能力

平台插件系统提供以下核心能力：

1. **数据处理能力**
   - 自定义数据源和解析器
   - 数据转换和过滤功能
   - 数据可视化和分析

2. **界面扩展能力**
   - 自定义视图和面板
   - 命令和菜单扩展
   - 自定义工具栏和状态栏

3. **时间控制能力**
   - 自定义时间线和事件标记
   - 播放控制和同步机制
   - 时间点定位和跳转

4. **标注系统能力**
   - 自定义标注工具
   - 标注数据管理
   - 标注工作流定制

### 插件开发指南

#### 创建插件

开发者可以通过以下简单步骤创建插件：

1. **创建插件项目**：使用平台提供的脚手架工具创建插件项目
2. **编写插件清单**：定义插件的基本信息和扩展点
3. **实现插件功能**：使用平台提供的 API 实现插件功能
4. **打包和发布**：将插件打包并发布到插件市场

#### 插件清单示例

每个插件需要提供一个清单文件，用于声明插件的基本信息和能力：

```json
{
  "name": "my-custom-plugin",
  "displayName": "自定义插件",
  "version": "1.0.0",
  "description": "数据可视化和分析插件",
  "main": "./dist/extension.js",
  "contributes": {
    "views": [
      {
        "id": "myPlugin.dataView",
        "name": "数据视图"
      }
    ],
    "commands": [
      {
        "command": "myPlugin.analyze",
        "title": "分析数据"
      }
    ]
  },
  "activationEvents": ["onView:myPlugin.dataView"]
}
```

#### 插件 API 使用

平台提供了丰富的 API 供插件调用：

```typescript
// 插件入口示例
export function activate(context) {
  // 注册命令
  context.subscriptions.push(
    commands.registerCommand('myPlugin.analyze', () => {
      // 实现命令逻辑
    })
  );

  // 注册视图
  const dataTreeProvider = new DataTreeProvider();
  context.subscriptions.push(
    window.registerTreeDataProvider('myPlugin.dataView', dataTreeProvider)
  );

  // 订阅事件
  context.subscriptions.push(
    events.onDataLoaded(data => {
      // 处理数据加载事件
    })
  );
}
```

### 标注平台集成

平台设计支持标注功能的无缝集成：

1. **标注工作流**
   - 通过插件自定义标注工作流程
   - 提供标注任务分配和管理
   - 支持多人协作标注

2. **标注工具**
   - 通过插件注册自定义标注工具
   - 扩展标注界面和交互方式
   - 提供标注辅助功能

3. **数据管理**
   - 标注数据的版本控制
   - 标注质量评估和验证
   - 标注数据的导入/导出

通过这种简洁而强大的插件系统，@caterpillarsoft/studio 使开发者能够轻松扩展平台功能，满足不同场景的需求。
