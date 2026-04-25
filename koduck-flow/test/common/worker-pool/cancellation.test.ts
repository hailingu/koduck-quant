import { describe, it, expect, beforeEach } from "vitest";
import { CancellationTokenSource } from "../../../src/common/worker-pool/cancellation";
import { WorkerPoolError } from "../../../src/common/worker-pool/types";

describe("CancellationTokenSource", () => {
  let source: CancellationTokenSource;

  beforeEach(() => {
    source = new CancellationTokenSource();
  });

  describe("token", () => {
    it("should return a cancellation token", () => {
      const token = source.token;
      expect(token).toBeDefined();
      expect(typeof token.isCancellationRequested).toBe("boolean");
      expect(typeof token.onCancellation).toBe("function");
      expect(typeof token.throwIfCancellationRequested).toBe("function");
    });
  });

  describe("cancel", () => {
    it("should mark token as cancelled", () => {
      expect(source.token.isCancellationRequested).toBe(false);

      source.cancel();

      expect(source.token.isCancellationRequested).toBe(true);
    });

    it("should be idempotent", () => {
      source.cancel();
      expect(source.token.isCancellationRequested).toBe(true);

      source.cancel(); // Second call
      expect(source.token.isCancellationRequested).toBe(true);
    });
  });

  describe("isCancellationRequested", () => {
    it("should return false before cancellation", () => {
      expect(source.token.isCancellationRequested).toBe(false);
    });

    it("should return true after cancellation", () => {
      source.cancel();
      expect(source.token.isCancellationRequested).toBe(true);
    });
  });

  describe("onCancellation", () => {
    it("should call callback immediately if already cancelled", () => {
      source.cancel();

      let called = false;
      source.token.onCancellation(() => {
        called = true;
      });

      expect(called).toBe(true);
    });

    it("should call callback when cancelled", () => {
      let called = false;
      source.token.onCancellation(() => {
        called = true;
      });

      expect(called).toBe(false);

      source.cancel();

      expect(called).toBe(true);
    });

    it("should call multiple callbacks", () => {
      let callCount = 0;
      source.token.onCancellation(() => callCount++);
      source.token.onCancellation(() => callCount++);

      source.cancel();

      expect(callCount).toBe(2);
    });

    it("should not call callback after cancellation if added after", () => {
      source.cancel();

      let called = false;
      source.token.onCancellation(() => {
        called = true;
      });

      // Should have been called immediately
      expect(called).toBe(true);
    });

    it("should handle callback exceptions gracefully", () => {
      source.token.onCancellation(() => {
        throw new Error("Callback error");
      });

      source.token.onCancellation(() => {
        // This should still be called
      });

      expect(() => source.cancel()).not.toThrow();
    });
  });

  describe("throwIfCancellationRequested", () => {
    it("should not throw if not cancelled", () => {
      expect(() => source.token.throwIfCancellationRequested()).not.toThrow();
    });

    it("should throw WorkerPoolError if cancelled", () => {
      source.cancel();

      expect(() => source.token.throwIfCancellationRequested()).toThrow(WorkerPoolError);
      expect(() => source.token.throwIfCancellationRequested()).toThrow("Task has been cancelled");
    });
  });
});
