/**
 * 行情 API 性能测试
 * 
 * 场景: 获取股票实时行情
 * 特点: 读操作，缓存友好
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, generateOptions } from './k6-config.js';

// 测试股票代码池
const SYMBOLS = ['000001.SZ', '000002.SZ', '600000.SH', '600519.SH', '300750.SZ'];

export const options = generateOptions('market-quote', 50, '3m');

export default function () {
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const response = http.get(
    `${BASE_URL}/api/market/quote?symbol=${symbol}`,
    { headers: DEFAULT_HEADERS }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has price data': (r) => r.json('price') !== undefined,
  });
  
  sleep(1);
}
