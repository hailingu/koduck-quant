/**
 * Health API 性能测试脚本
 *
 * 用于验证服务基本可用性和响应时间基线
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // 30秒内逐渐增加到10个虚拟用户
    { duration: '1m', target: 10 },   // 保持1分钟
    { duration: '30s', target: 0 },   // 30秒内逐渐降级
  ],
  thresholds: {
    // P95 延迟应小于 200ms
    http_req_duration: ['p(95)<200'],
    // 错误率应小于 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const url = `${BASE_URL}/actuator/health`;
  const response = http.get(url);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'status is UP': (r) => r.json('status') === 'UP',
  });

  sleep(1);
}
