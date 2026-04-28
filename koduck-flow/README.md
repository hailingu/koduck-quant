# Koduck Flow

> **现代化的 TypeScript 流程管理与实体渲染框架**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/koduck-flow/koduck-flow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)](https://github.com/koduck-flow/koduck-flow)

Koduck Flow 是一个功能强大、类型安全的流程管理和实体渲染框架，提供完整的依赖注入、多租户隔离和生命周期管理能力。

## ✨ 核心特性

- 🎯 **类型安全**: 完整的 TypeScript 支持，严格的类型检查
- 🔄 **生命周期管理**: 完善的管理器初始化和资源清理机制
- 🌐 **多租户支持**: 隔离的运行时环境，支持资源配额和功能开关
- 🔌 **依赖注入**: 内置 DI 容器，灵活的服务管理
- 📊 **性能监控**: 内置指标收集和性能分析工具
- 🐛 **可视化调试**: 开发时的调试面板，直观展示系统状态
- ⚡ **高性能**: 针对大规模实体管理优化

## 🚀 快速开始

### 安装

\`\`\`bash

# 使用 pnpm（推荐）

pnpm add koduck-flow

# 使用 npm

npm install koduck-flow

# 使用 yarn

yarn add koduck-flow
\`\`\`

### 基础用法

\`\`\`typescript
import { createKoduckFlowRuntime } from 'koduck-flow';

// 创建运行时
const runtime = createKoduckFlowRuntime({
environment: 'development'
});

// 创建实体
const entity = runtime.createEntity('Node', {
x: 100,
y: 200,
label: 'Start'
});

console.log(\`创建了实体: \${entity.id}\`);

// 清理资源
await runtime.dispose();
\`\`\`

### React 集成

\`\`\`tsx
import { KoduckFlowProvider, useKoduckFlowRuntime } from 'koduck-flow';

function App() {
return (
<KoduckFlowProvider environment="production">
<MyComponent />
</KoduckFlowProvider>
);
}

function MyComponent() {
const runtime = useKoduckFlowRuntime();

const handleCreate = () => {
const entity = runtime.createEntity('Node', { x: 0, y: 0 });
console.log('已创建实体:', entity.id);
};

return <button onClick={handleCreate}>创建实体</button>;
}
\`\`\`

## 📚 文档

### 入门文档

- [系统设计概览](./docs/design-overview.md) - 设计理念和架构
- [开发指南](./docs/developer-guide.md) - 完整开发指南
- [架构指南](./docs/architecture.md) - 深入架构分析
- [测试指南](./docs/testing-guide.md) - 测试最佳实践
- [示例代码](./docs/examples/) - 实战示例

### 中文文档

- [系统设计概览 (中文)](./docs/zh/design-overview.md)
- [开发指南 (中文)](./docs/zh/developer-guide.md)
- [架构指南 (中文)](./docs/zh/architecture.md)
- [测试指南 (中文)](./docs/zh/testing-guide.md)

## 🎯 核心概念

### Runtime（运行时）

Runtime 是 Koduck Flow 的核心，管理所有组件的生命周期：

\`\`\`typescript
const runtime = createKoduckFlowRuntime({
environment: 'production',
tenant: {
id: 'tenant-1',
name: 'My Tenant'
}
});
\`\`\`

### Entity（实体）

实体是系统中的数据对象，具有唯一 ID、类型和数据：

\`\`\`typescript
// 创建实体
const entity = runtime.createEntity('Node', {
name: 'Node 1',
value: 100
});

// 访问实体
console.log(entity.id, entity.type, entity.data);

// 更新数据
entity.data = { ...entity.data, value: 200 };
\`\`\`

### Manager（管理器）

管理器负责特定功能领域的管理：

\`\`\`typescript
// 核心管理器
const entityManager = runtime.entityManager; // 实体管理
const renderManager = runtime.renderManager; // 渲染管理
const registryManager = runtime.registryManager; // 注册表管理

// 自定义管理器
runtime.registerManager('custom', () => new CustomManager());
const customManager = runtime.getManager('custom');
\`\`\`

### Event System（事件系统）

基于发布/订阅模式的事件系统：

\`\`\`typescript
// 订阅事件
const unsubscribe = runtime.eventBus.on('entity:created', (event) => {
console.log('实体已创建:', event.entity.id);
});

// 取消订阅
unsubscribe();
\`\`\`

## 🔧 高级特性

### 依赖注入

\`\`\`typescript
import { TOKENS } from 'koduck-flow';

// 访问核心服务
const logger = runtime.container.resolve(TOKENS.Logger);
const metrics = runtime.container.resolve(TOKENS.Metrics);

// 注册自定义服务
runtime.container.register('myService', () => new MyService());
\`\`\`

### 多租户隔离

\`\`\`typescript
const runtime = createKoduckFlowRuntime({
tenant: {
id: 'tenant-123',
name: 'Customer A',
features: {
advancedRendering: true
},
quota: {
maxEntities: 1000,
maxMemoryMB: 100
}
}
});

// 检查功能开关
if (runtime.tenant.features?.advancedRendering) {
// 使用高级功能
}
\`\`\`

### 性能监控

\`\`\`typescript
import { setMetricsProvider } from 'koduck-flow';

// 启用指标收集
setMetricsProvider({
enabled: true,
sampleRate: 1.0
});

// 记录自定义指标
const meter = runtime.container.resolve(TOKENS.Metrics);
const counter = meter.createCounter('my.operation');
counter.add(1, { status: 'success' });
\`\`\`

### 调试面板

\`\`\`typescript
const runtime = createKoduckFlowRuntime({
debugOptions: {
enabled: true,
panel: {
enabled: true,
position: 'bottom-right'
}
}
});
\`\`\`

## 🧪 测试

Koduck Flow 设计时就考虑了可测试性：

\`\`\`typescript
import { createKoduckFlowRuntime } from 'koduck-flow';

describe('MyFeature', () => {
let runtime;

beforeEach(() => {
runtime = createKoduckFlowRuntime({ environment: 'test' });
});

afterEach(async () => {
await runtime.dispose();
});

it('应该创建实体', () => {
const entity = runtime.createEntity('Node');
expect(entity).toBeDefined();
});
});
\`\`\`

## 📦 项目结构

\`\`\`text
koduck-flow/
├── src/
│ ├── common/ # 核心功能
│ │ ├── api/ # API 层
│ │ ├── entity/ # 实体系统
│ │ ├── render/ # 渲染系统
│ │ ├── event/ # 事件系统
│ │ ├── runtime/ # 运行时管理
│ │ ├── di/ # 依赖注入
│ │ ├── metrics/ # 性能指标
│ │ └── logger/ # 日志系统
│ ├── components/ # React 组件
│ │ ├── KoduckFlowProvider.tsx
│ │ ├── DebugPanel.tsx
│ │ └── hooks/ # React Hooks
│ └── index.ts # 主入口
├── docs/ # 文档
│ ├── design-overview.md # 设计概览
│ ├── developer-guide.md # 开发指南
│ ├── architecture.md # 架构文档
│ ├── testing-guide.md # 测试指南
│ ├── examples/ # 示例
│ └── zh/ # 中文文档
└── test/ # 测试
\`\`\`

## 🛠️ 开发

### 安装依赖

\`\`\`bash
pnpm install
\`\`\`

### 开发模式

\`\`\`bash
pnpm dev
\`\`\`

### 运行测试

\`\`\`bash

# 运行所有单元测试

pnpm test

# 监听模式

pnpm test:watch

# 生成覆盖率报告

pnpm test:coverage

# 运行 E2E 测试

pnpm test:e2e:core

# E2E 测试（可见浏览器）

pnpm test:e2e:core --headed --workers=1
\`\`\`

详细 E2E 测试文档请查看 [Testing Guide](./docs/testing-guide.md#end-to-end-e2e-testing-with-playwright)。

### 构建

\`\`\`bash
pnpm build
\`\`\`

### 代码检查

\`\`\`bash
pnpm lint
\`\`\`

## 📊 性能基准

Koduck Flow 在大规模场景下表现优秀：

- ✅ 可管理 10,000+ 实体
- ✅ 实体创建 < 1ms
- ✅ 事件处理 < 0.5ms
- ✅ 内存占用优化

详细基准测试报告见 [benchmarks](./docs/benchmarks/)。

## 🤝 贡献

欢迎贡献！请查看我们的贡献指南。

### 贡献方式

- **提交模版**: 仓库根目录提供 `.gitmessage`，请运行 `git config commit.template .gitmessage` 以启用统一的提交信息格式。
- **CI/CD**: 所有 PR 与针对 `main`、`develop`、`release/**` 的 push 会触发 `.github/workflows/ci.yml`，自动执行 lint、单测覆盖率、内存压力测试、构建与 E2E 冒烟用例。

- 🐛 报告 Bug
- ✨ 提交新功能
- 📝 改进文档
- 🧪 增加测试覆盖

## 📄 许可证

本项目采用 MIT 许可证。

## 🔗 相关链接

- [问题追踪](https://github.com/koduck-flow/koduck-flow/issues)
- [讨论区](https://github.com/koduck-flow/koduck-flow/discussions)

## 💬 获取帮助

- 📖 [文档](./docs/)
- 🐛 [Issues](https://github.com/koduck-flow/koduck-flow/issues)

---

**使用 Koduck Flow 构建出色的应用！** 🦆

如果这个项目对你有帮助，请给我们一个 ⭐️
