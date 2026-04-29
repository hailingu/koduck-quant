/**
 * Hash and numeric processing utility functions
 * @module runtime/utils/hash-utils
 */

/**
 * Compute the hash value of a string
 *
 * Uses a simple hash algorithm (based on Java String.hashCode()),
 * for quickly generating a numeric identifier for a string.
 *
 * Characteristics of this algorithm:
 * - Deterministic: same input always produces same output
 * - Fast: O(n) time complexity
 * - Good distribution: different inputs tend to produce different hash values
 *
 * @param input - String to hash
 * @returns 32-bit unsigned integer hash value
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
 * Clamp a numeric value to the percentage range [0, 100]
 *
 * This function ensures percentage values stay within the valid range:
 * - Values less than 0 are clamped to 0
 * - Values greater than 100 are clamped to 100
 * - NaN is converted to 0
 * - Values within the normal range remain unchanged
 *
 * @param value - Value to clamp
 * @returns Clamped value in range [0, 100]
 *
 * @example
 * ```typescript
 * clampPercentage(-10);   // returns 0
 * clampPercentage(50);    // returns 50
 * clampPercentage(150);   // returns 100
 * clampPercentage(NaN);   // returns 0
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
