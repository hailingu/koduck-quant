/**
 * 投资组合摘要 API 性能测试
 * 
 * 场景: 获取用户投资组合摘要（总成本、市值、盈亏）
 * 特点: 需要认证，涉及聚合计算，数据库查询
 * 端点: GET /api/v1/portfolio/summary
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, generateOptions } from './k6-config.js';

// 测试配置：中等并发，关注响应稳定性
export const options = generateOptions('portfolio-summary', 30, '3m');

export default function () {
  const response = http.get(
    `${BASE_URL}/api/v1/portfolio/summary`,
    { headers: DEFAULT_HEADERS }
  );
  
  check(response, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has content when authorized': (r) => {
      if (r.status === 200) {
        const body = r.json();
        return body && (body.data !== undefined || body.code !== undefined);
      }
      return true;
    },
  });
  
  sleep(1);
}
