/**
 * 混合负载测试
 * 
 * 模拟真实场景：多种 API 按比例混合调用
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS } from './k6-config.js';

export const options = {
  scenarios: {
    health_check: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'healthCheck',
    },
    market_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'marketRead',
    },
    user_operations: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      exec: 'userOperations',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const SYMBOLS = ['000001.SZ', '000002.SZ', '600000.SH', '600519.SH'];

export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { 'health OK': (r) => r.status === 200 });
  sleep(1);
}

export function marketRead() {
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const res = http.get(
    `${BASE_URL}/api/market/quote?symbol=${symbol}`,
    { headers: DEFAULT_HEADERS }
  );
  check(res, { 'quote OK': (r) => r.status === 200 });
  sleep(1);
}

export function userOperations() {
  const res = http.get(
    `${BASE_URL}/api/users/profile`,
    { headers: DEFAULT_HEADERS }
  );
  check(res, { 'profile OK': (r) => r.status === 200 || r.status === 401 });
  sleep(2);
}
