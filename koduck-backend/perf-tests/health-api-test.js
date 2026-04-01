/**
 * Health API 性能测试
 * 
 * 场景: 健康检查接口
 * 特点: 无认证，轻量级
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, generateOptions } from './k6-config.js';

export const options = generateOptions('health-api', 100, '2m');

export default function () {
  const response = http.get(`${BASE_URL}/api/health`);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
    'body contains status': (r) => r.body.includes('UP'),
  });
  
  sleep(1);
}
