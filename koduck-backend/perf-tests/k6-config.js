/**
 * K6 性能测试配置
 * 
 * 使用方式:
 *   k6 run --env BASE_URL=http://localhost:8080 k6-config.js
 * 
 * 环境变量:
 *   BASE_URL - 被测服务基础 URL
 *   API_TOKEN - 认证令牌 (可选)
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const API_TOKEN = __ENV.API_TOKEN || '';

// 性能阈值配置
export const THRESHOLDS = {
  // P50 延迟 < 100ms
  http_req_duration: ['p(50)<100'], 
  // P95 延迟 < 500ms
  http_req_duration: ['p(95)<500'],
  // P99 延迟 < 1000ms
  http_req_duration: ['p(99)<1000'],
  // 错误率 < 1%
  http_req_failed: ['rate<0.01'],
};

// 默认请求头
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

if (API_TOKEN) {
  DEFAULT_HEADERS['Authorization'] = `Bearer ${API_TOKEN}`;
}

/**
 * 生成性能测试选项
 * @param {string} name - 测试名称
 * @param {number} rps - 目标 RPS
 * @param {string} duration - 测试持续时间
 */
export function generateOptions(name, rps, duration) {
  return {
    stages: [
      { duration: '30s', target: rps },      //  ramp up
      { duration: duration, target: rps },   //  steady state
      { duration: '30s', target: 0 },        //  ramp down
    ],
    thresholds: THRESHOLDS,
    tags: {
      testName: name,
    },
  };
}
