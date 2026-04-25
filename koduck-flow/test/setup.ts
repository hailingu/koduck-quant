/**
 * Vitest 测试环境设置
 * 提供浏览器 API 的 polyfills 和 mocks
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Canvas API
class MockCanvasRenderingContext2D {
  canvas = {
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    getContext: () => this,
    style: {},
  };

  // 绘图方法
  fillRect = vi.fn();
  clearRect = vi.fn();
  strokeRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  scale = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  transform = vi.fn();
  setTransform = vi.fn();
  resetTransform = vi.fn();
  drawImage = vi.fn();
  putImageData = vi.fn();
  getImageData = vi.fn((x: number, y: number, width: number, height: number) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }));
  createImageData = vi.fn();
  measureText = vi.fn(() => ({ width: 100 }));
  fillText = vi.fn();
  strokeText = vi.fn();

  // 样式属性
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  miterLimit = 10;
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  globalAlpha = 1;
  globalCompositeOperation = "source-over";
}

class MockHTMLCanvasElement {
  width = 800;
  height = 600;
  style = {};

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height,
      width: this.width,
      height: this.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  getContext() {
    return new MockCanvasRenderingContext2D();
  }

  toDataURL() {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }

  toBlob = vi.fn();
  transferControlToOffscreen = vi.fn();
}

const createMock2DContext = () => new MockCanvasRenderingContext2D();

const mockWebGPUCanvasContext = {
  configure: vi.fn(),
  getCurrentTexture: vi.fn(() => ({
    createView: vi.fn(),
  })),
  unconfigure: vi.fn(),
};

const getContextMock = vi.fn((contextId?: string) => {
  if (!contextId) {
    return createMock2DContext();
  }

  const normalizedId = contextId.toLowerCase();

  if (
    normalizedId === "2d" ||
    normalizedId === "bitmaprenderer" ||
    normalizedId === "webgl" ||
    normalizedId === "webgl2"
  ) {
    return createMock2DContext();
  }

  if (normalizedId === "webgpu") {
    return mockWebGPUCanvasContext;
  }

  return null;
});

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: getContextMock,
    writable: true,
    configurable: true,
  });
}

// Mock window object if it doesn't exist
if (typeof window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: {
      devicePixelRatio: 1,
      innerWidth: 1024,
      innerHeight: 768,
      requestAnimationFrame: vi.fn((callback) => {
        return setTimeout(callback, 16);
      }),
      cancelAnimationFrame: vi.fn((id) => {
        clearTimeout(id);
      }),
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getComputedStyle: vi.fn(() => ({})),
      location: {
        href: "http://localhost:3000",
        origin: "http://localhost:3000",
        protocol: "http:",
        host: "localhost:3000",
        hostname: "localhost",
        port: "3000",
        pathname: "/",
        search: "",
        hash: "",
      },
      navigator: {
        userAgent: "Node.js",
        language: "en-US",
        platform: "node",
      },
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
      },
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        go: vi.fn(),
      },
    },
    writable: true,
    configurable: true,
  });
}

// Mock document if it doesn't exist
if (typeof document === "undefined") {
  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: vi.fn((tagName) => {
        if (tagName === "canvas") {
          return new MockHTMLCanvasElement();
        }
        return {
          tagName: tagName.toUpperCase(),
          innerHTML: "",
          innerText: "",
          textContent: "",
          style: {},
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false),
            toggle: vi.fn(),
          },
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
          removeAttribute: vi.fn(),
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          querySelector: vi.fn(),
          querySelectorAll: vi.fn(() => []),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          getBoundingClientRect: vi.fn(() => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
          })),
        };
      }),
      getElementById: vi.fn(),
      getElementsByClassName: vi.fn(() => []),
      getElementsByTagName: vi.fn(() => []),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        style: {},
      },
      head: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    },
    writable: true,
    configurable: true,
  });
}

// Mock performance.now with more realistic timing
let mockTime = 0;

Object.defineProperty(performance, "now", {
  value: vi.fn(() => {
    mockTime += Math.random() * 2 + 0.1; // 模拟0.1-2.1ms的随机执行时间
    return mockTime;
  }),
  writable: true,
  configurable: true,
});

// Handle unhandled promise rejections from worker pool disposal
// These are expected during test cleanup when tasks are cancelled
process.on("unhandledRejection", () => {
  // Silently ignore unhandled rejections - they're expected during test disposal
});

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

// Export for use in tests
export { MockCanvasRenderingContext2D, MockHTMLCanvasElement };
