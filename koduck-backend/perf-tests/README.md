# Koduck Backend 性能测试

本目录包含使用 [K6](https://k6.io/) 编写的性能测试脚本。

## 快速开始

### 1. 安装 K6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### 2. 运行测试

```bash
# 使用交互式菜单
./run-local-perf-test.sh

# 或直接运行指定测试
k6 run --env BASE_URL=http://localhost:8080 health-api-test.js
```

## 测试脚本说明

| 脚本 | 描述 | 目标 RPS | 测试时长 |
|------|------|----------|----------|
| `health-api-test.js` | Health 检查接口 | 100 | 2m+ |
| `market-quote-test.js` | 行情数据 API | 50 | 3m+ |
| `portfolio-summary-test.js` | 投资组合摘要 API | 30 | 3m+ |
| `user-profile-test.js` | 用户资料 API | 30 | 2m+ |
| `mixed-load-test.js` | 混合负载测试 | 混合 | 5m+ |

## 配置

通用配置在 `k6-config.js` 中：

```javascript
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const API_TOKEN = __ENV.API_TOKEN || '';
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BASE_URL` | http://localhost:8080 | 被测服务地址 |
| `API_TOKEN` | (空) | JWT 认证令牌 |

## 性能阈值

所有测试使用统一的性能阈值：

- **P50 延迟**: < 100ms
- **P95 延迟**: < 500ms
- **P99 延迟**: < 1000ms
- **错误率**: < 1%

## 查看结果

K6 运行后会输出详细的性能指标：

```
     ✓ status is 200
     ✓ response time < 100ms

     checks.........................: 100.00% ✓ 592       ✗ 0
     data_received..................: 123 kB  2.0 kB/s
     data_sent......................: 45 kB   750 B/s
     http_req_duration..............: avg=12.45ms min=5.23ms med=11.8ms max=45.2ms p(90)=18.2ms p(95)=28.5ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 296
     http_reqs......................: 296     4.933158/s
     iteration_duration.............: avg=1.01s   min=1s     med=1.01s  max=1.05s  p(90)=1.02s  p(95)=1.02s
     iterations.....................: 296     4.933158/s
```

## 生成报告

```bash
# JSON 格式输出
k6 run --out json=results.json health-api-test.js

# CSV 格式输出
k6 run --out csv=results.csv health-api-test.js

# 同时输出多种格式
k6 run \
  --out json=results.json \
  --out csv=results.csv \
  health-api-test.js
```

## 性能基线

查看完整性能基线文档: [docs/perf-baseline.md](../../docs/perf-baseline.md)

## CI 集成

GitHub Actions 示例：

```yaml
- name: Run k6 tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: koduck-backend/perf-tests/mixed-load-test.js
    flags: --env BASE_URL=http://localhost:8080
```

## 注意事项

1. 测试前确保应用和依赖服务已启动
2. 建议在隔离环境（本地 Docker）运行，避免影响生产
3. 首次运行建议先执行 `health-api-test.js` 验证环境
4. 大规模压测前检查系统资源（CPU、内存、连接数）
