/**
 * 哈希和数值处理工具函数
 * @module runtime/utils/hash-utils
 */

/**
 * 计算字符串的哈希值
 *
 * 使用简单的哈希算法（基于 Java String.hashCode()），
 * 用于快速生成字符串的数值标识。
 *
 * 该算法的特点：
 * - 确定性：相同输入总是产生相同输出
 * - 快速：时间复杂度 O(n)
 * - 分布良好：不同输入倾向于产生不同哈希值
 *
 * @param input - 待哈希的字符串
 * @returns 32位无符号整数哈希值
 *
 * @example
 * ```typescript
 * const hash1 = hashString('tenant-123');
 * const hash2 = hashString('tenant-123'); // hash1 === hash2
 * const hash3 = hashString('tenant-456'); // hash3 !== hash1
 * ```
 */
export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + (input.codePointAt(i) ?? 0)) >>> 0;
  }
  return hash;
}

/**
 * 将数值夹紧到百分比范围 [0, 100]
 *
 * 该函数用于确保百分比值在有效范围内：
 * - 小于 0 的值被夹紧为 0
 * - 大于 100 的值被夹紧为 100
 * - NaN 被转换为 0
 * - 正常范围内的值保持不变
 *
 * @param value - 待夹紧的数值
 * @returns 夹紧后的值，范围 [0, 100]
 *
 * @example
 * ```typescript
 * clampPercentage(-10);   // 返回 0
 * clampPercentage(50);    // 返回 50
 * clampPercentage(150);   // 返回 100
 * clampPercentage(NaN);   // 返回 0
 * ```
 */
export function clampPercentage(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}
