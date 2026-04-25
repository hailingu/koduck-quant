/**
 * 哈希工具函数单元测试
 */

import { describe, it, expect } from "vitest";
import { hashString, clampPercentage } from "../../../../src/common/runtime/utils/hash-utils";

describe("hash-utils", () => {
  describe("hashString", () => {
    it("should return 0 for empty string", () => {
      const hash = hashString("");
      expect(hash).toBe(0);
    });

    it("should return consistent hash for same input", () => {
      const input = "tenant-123";
      const hash1 = hashString(input);
      const hash2 = hashString(input);
      expect(hash1).toBe(hash2);
    });

    it("should return different hashes for different inputs", () => {
      const hash1 = hashString("tenant-123");
      const hash2 = hashString("tenant-456");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle single character strings", () => {
      const hash = hashString("a");
      expect(typeof hash).toBe("number");
      expect(hash).toBeGreaterThan(0);
    });

    it("should handle long strings", () => {
      const longString = "a".repeat(10000);
      const hash = hashString(longString);
      expect(typeof hash).toBe("number");
    });

    it("should handle strings with special characters", () => {
      const hash1 = hashString("Hello, 世界!");
      const hash2 = hashString("Hello, World!");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle strings with emojis", () => {
      const hash1 = hashString("tenant-😀");
      const hash2 = hashString("tenant-😁");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 32-bit unsigned integer", () => {
      const hash = hashString("test-string-123");
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    });

    it("should handle case sensitivity", () => {
      const hash1 = hashString("TenantId");
      const hash2 = hashString("tenantid");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle whitespace differences", () => {
      const hash1 = hashString("tenant id");
      const hash2 = hashString("tenantid");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce well-distributed hashes for sequential inputs", () => {
      const hashes = new Set<number>();
      for (let i = 0; i < 100; i += 1) {
        hashes.add(hashString(`tenant-${i}`));
      }
      // 验证哈希值分布良好（至少95个不同的哈希值）
      expect(hashes.size).toBeGreaterThanOrEqual(95);
    });
  });

  describe("clampPercentage", () => {
    it("should return 0 for NaN", () => {
      const result = clampPercentage(NaN);
      expect(result).toBe(0);
    });

    it("should return 0 for negative values", () => {
      expect(clampPercentage(-1)).toBe(0);
      expect(clampPercentage(-10)).toBe(0);
      expect(clampPercentage(-100)).toBe(0);
      expect(clampPercentage(-Infinity)).toBe(0);
    });

    it("should return 100 for values greater than 100", () => {
      expect(clampPercentage(101)).toBe(100);
      expect(clampPercentage(150)).toBe(100);
      expect(clampPercentage(1000)).toBe(100);
      expect(clampPercentage(Infinity)).toBe(100);
    });

    it("should return input value for valid percentages", () => {
      expect(clampPercentage(0)).toBe(0);
      expect(clampPercentage(1)).toBe(1);
      expect(clampPercentage(25)).toBe(25);
      expect(clampPercentage(50)).toBe(50);
      expect(clampPercentage(75)).toBe(75);
      expect(clampPercentage(99)).toBe(99);
      expect(clampPercentage(100)).toBe(100);
    });

    it("should handle decimal values", () => {
      expect(clampPercentage(0.5)).toBe(0.5);
      expect(clampPercentage(25.75)).toBe(25.75);
      expect(clampPercentage(99.99)).toBe(99.99);
    });

    it("should handle boundary values", () => {
      expect(clampPercentage(0)).toBe(0);
      expect(clampPercentage(100)).toBe(100);
      expect(clampPercentage(-0)).toBe(0);
      expect(clampPercentage(100.0)).toBe(100);
    });

    it("should handle very small positive values", () => {
      expect(clampPercentage(0.001)).toBe(0.001);
      expect(clampPercentage(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
    });

    it("should handle very large values", () => {
      expect(clampPercentage(Number.MAX_VALUE)).toBe(100);
      expect(clampPercentage(1e10)).toBe(100);
    });

    it("should handle edge case around 0", () => {
      expect(clampPercentage(-0.1)).toBe(0);
      expect(clampPercentage(0)).toBe(0);
      expect(clampPercentage(0.1)).toBe(0.1);
    });

    it("should handle edge case around 100", () => {
      expect(clampPercentage(99.9)).toBe(99.9);
      expect(clampPercentage(100)).toBe(100);
      expect(clampPercentage(100.1)).toBe(100);
    });
  });
});
