/**
 * 行情数据 API 性能测试脚本
 *
 * 测试股票行情查询接口性能
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // 30秒内逐渐增加到20个虚拟用户
    { duration: '2m', target: 20 },   // 保持2分钟
    { duration: '30s', target: 0 },   // 30秒内逐渐降级
  ],
  thresholds: {
    // P95 延迟应小于 500ms
    http_req_duration: ['p(95)<500'],
    // 错误率应小于 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// 测试股票代码池
const symbols = [
  '000001.SZ',  // 平安银行
  '000002.SZ',  // 万科A
  '600000.SH',  // 浦发银行
  '600519.SH',  // 贵州茅台
  '300750.SZ',  // 宁德时代
];

export default function () {
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const url = `${BASE_URL}/api/v1/market/quote?symbol=${symbol}`;

  const response = http.get(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has symbol in response': (r) => r.json('symbol') !== undefined,
  });

  sleep(0.5);
}
