# KoduckFlow Configuration System

## 概述

KoduckFlow 配置系统提供了一个统一的配置管理机制，支持多种配置源的优先级合并和运行时覆盖。

## 配置优先级

配置按以下优先级从高到低合并：

1. **运行时参数** - 通过 `load(options)` 传递的参数
2. **环境变量** - 以 `KODUCKFLOW_` 开头的环境变量
3. **配置文件** - JSON 配置文件
4. **默认值** - 硬编码的默认配置

## 配置文件位置

系统按以下顺序查找配置文件：

1. `./koduckflow.config.json`
2. `./config/koduckflow.config.json`
3. `./src/config/koduckflow.config.json`

## 配置结构

### 环境配置

```typescript
environment: "development" | "staging" | "production";
```

### 事件系统配置

```typescript
event: {
  batchSize: number; // 批处理大小
  batchInterval: number; // 批处理间隔 (ms)
  maxQueueSize: number; // 最大队列大小
  enableDedup: boolean; // 启用去重
  concurrencyLimit: number; // 并发限制
  maxListeners: number; // 最大监听器数量
}
```

### 渲染系统配置

```typescript
render: {
  frameRate: number; // 目标帧率
  cacheTTL: number; // 缓存TTL (ms)
  maxCacheSize: number; // 最大缓存条目数
  defaultRenderer: "react" | "canvas" | "webgpu";
  enableDirtyRegion: boolean; // 启用脏区域优化
  constants: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
  }
}
```

### 实体系统配置

```typescript
entity: {
  maxEntities: number; // 最大实体数量
  defaultTTL: number; // 默认TTL (ms)
  maxSize: number; // 最大大小
  defaultTimeout: number; // 默认超时 (ms)
  enablePooling: boolean; // 启用对象池
  poolSize: number; // 对象池大小
}
```

### 性能监控配置

```typescript
performance: {
  enableProfiling: boolean; // 启用性能分析
  metricsInterval: number; // 指标收集间隔 (ms)
  enableVerboseLogging: boolean; // 启用详细日志
}
```

### 租户配置

```typescript
tenant: {
  isolationLevel: "database" | "schema" | "table";
  maxTenants: number; // 最大租户数量
  defaultQuota: number; // 默认配额
  enableCaching: boolean; // 启用缓存
}
```

### 插件配置

```typescript
plugin: {
  maxPlugins: number;        // 最大插件数量
  enableHotReload: boolean;  // 启用热重载
  securityLevel: "low" | "medium" | "high";
  allowedDomains: string[];  // 允许的域名
}
```

## 环境变量

支持以下环境变量：

### 事件配置

- `KODUCKFLOW_EVENT_BATCH_SIZE`: 批处理大小
- `KODUCKFLOW_EVENT_BATCH_INTERVAL`: 批处理间隔
- `KODUCKFLOW_EVENT_MAX_QUEUE_SIZE`: 最大队列大小

### 渲染配置

- `KODUCKFLOW_RENDER_FRAME_RATE`: 帧率
- `KODUCKFLOW_RENDER_CACHE_TTL`: 缓存TTL

### 性能配置

- `KODUCKFLOW_PERFORMANCE_ENABLE_PROFILING`: 启用性能分析 (true/false)
- `KODUCKFLOW_PERFORMANCE_METRICS_INTERVAL`: 指标间隔

## 使用方法

### 基本使用

```typescript
import { getConfig } from "./config/loader";

// 获取配置
const config = getConfig();

// 使用配置
console.log(config.event.batchSize);
console.log(config.render.frameRate);
```

### 运行时覆盖

```typescript
import { getConfigLoader } from "./config/loader";

const loader = getConfigLoader();
const config = loader.load({
  event: { batchSize: 200 },
  render: { frameRate: 120 },
});
```

### 热重载

```typescript
import { getConfigLoader } from "./config/loader";

const loader = getConfigLoader();

// 启用热重载
loader.enableHotReload();

// 监听配置变更
loader.onConfigChange((newConfig) => {
  console.log("Configuration updated:", newConfig);
});

// 禁用热重载
loader.disableHotReload();
```

### 重新加载配置

```typescript
import { reloadConfig } from "./config/loader";

// 重新加载配置
const newConfig = reloadConfig();
```

## 浏览器环境支持

在浏览器环境中，可以通过全局变量 `window.KODUCKFLOW_CONFIG` 提供配置：

```javascript
window.KODUCKFLOW_CONFIG = {
  environment: "production",
  event: { batchSize: 500 },
};
```

## 配置验证

系统会自动验证配置的有效性，包括：

- 环境值必须是 "development"、"staging" 或 "production"
- 数值字段必须在合理范围内
- 枚举字段必须是有效值

无效的配置会导致加载失败并抛出错误。
