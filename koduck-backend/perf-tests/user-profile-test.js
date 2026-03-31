/**
 * 用户资料 API 性能测试
 * 
 * 场景: 获取用户个人信息
 * 特点: 需要认证，数据库查询
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, generateOptions } from './k6-config.js';

export const options = generateOptions('user-profile', 30, '2m');

export default function () {
  const response = http.get(
    `${BASE_URL}/api/users/profile`,
    { headers: DEFAULT_HEADERS }
  );
  
  check(response, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  sleep(1);
}
