/**
 * 混合负载性能测试脚本
 *
 * 模拟真实业务负载场景
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

// 测试配置
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // 1分钟内逐渐增加到50个虚拟用户
    { duration: '3m', target: 50 },   // 保持3分钟
    { duration: '1m', target: 0 },    // 1分钟内逐渐降级
  ],
  thresholds: {
    // P95 延迟应小于 1s
    http_req_duration: ['p(95)<1000'],
    // 错误率应小于 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// 股票代码池
const symbols = [
  '000001.SZ', '000002.SZ', '600000.SH', '600519.SH', '300750.SZ',
  '000858.SZ', '002415.SZ', '600036.SH', '601318.SH', '000333.SZ',
];

// 场景权重
const scenarios = [
  { name: 'health', weight: 0.2 },      // 20% - Health 检查
  { name: 'market_quote', weight: 0.5 }, // 50% - 行情查询
  { name: 'market_indices', weight: 0.2 }, // 20% - 指数查询
  { name: 'kline', weight: 0.1 },        // 10% - K线数据
];

export default function () {
  const random = Math.random();
  let cumulativeWeight = 0;
  let selectedScenario = scenarios[0].name;

  for (const scenario of scenarios) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      selectedScenario = scenario.name;
      break;
    }
  }

  switch (selectedScenario) {
    case 'health':
      testHealth();
      break;
    case 'market_quote':
      testMarketQuote();
      break;
    case 'market_indices':
      testMarketIndices();
      break;
    case 'kline':
      testKline();
      break;
  }

  sleep(0.5);
}

function testHealth() {
  const url = `${BASE_URL}/actuator/health`;
  const response = http.get(url);

  check(response, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
}

function testMarketQuote() {
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const url = `${BASE_URL}/api/v1/market/quote?symbol=${symbol}`;
  const response = http.get(url);

  check(response, {
    'quote status is 200': (r) => r.status === 200,
    'quote response time < 500ms': (r) => r.timings.duration < 500,
  });
}

function testMarketIndices() {
  const url = `${BASE_URL}/api/v1/market/indices`;
  const response = http.get(url);

  check(response, {
    'indices status is 200': (r) => r.status === 200,
    'indices response time < 500ms': (r) => r.timings.duration < 500,
  });
}

function testKline() {
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const url = `${BASE_URL}/api/v1/market/kline?symbol=${symbol}&period=daily&limit=30`;
  const response = http.get(url);

  check(response, {
    'kline status is 200': (r) => r.status === 200,
    'kline response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}
