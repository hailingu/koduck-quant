/**
 * Migration Test Helpers
 *
 * Utilities to assist with testing during API migration.
 */
import { DuckFlowProvider } from "../../src/components/DuckFlowProvider";
import {
  createDuckFlowRuntime,
  type DuckFlowRuntime,
  type DuckFlowRuntimeOptions,
} from "../../src/common/runtime";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";

// Global registry for test runtimes to ensure cleanup
const testRuntimes: Set<DuckFlowRuntime> = new Set();

/**
 * Create a test-specific runtime instance with automatic cleanup
 *
 * @param options - Optional runtime configuration
 * @returns A DuckFlowRuntime instance
 *
 * @example
 * ```typescript
 * let runtime: DuckFlowRuntime;
 *
 * beforeEach(() => {
 *   runtime = createTestRuntime();
 * });
 *
 * afterEach(() => {
 *   runtime.dispose();
 * });
 * ```
 */
export function createTestRuntime(options?: DuckFlowRuntimeOptions): DuckFlowRuntime {
  const runtime = createDuckFlowRuntime(options);
  testRuntimes.add(runtime);
  return runtime;
}

/**
 * Clean up all test runtimes
 *
 * Should be called in afterEach or after(All) hooks
 */
export function cleanupTestRuntimes(): void {
  for (const runtime of testRuntimes) {
    try {
      runtime.dispose();
    } catch (error) {
      console.error("Error disposing test runtime:", error);
    }
  }
  testRuntimes.clear();
}

/**
 * Render a component with DuckFlowProvider wrapper
 *
 * @param ui - The React element to render
 * @param options - Optional render options including runtime config
 * @returns Render result from @testing-library/react
 *
 * @example
 * ```typescript
 * test('renders editor', () => {
 *   const { container } = renderWithProvider(<WorkflowEditor />);
 *   expect(container).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProvider(
  ui: React.ReactElement,
  options?: RenderOptions & {
    runtimeOptions?: DuckFlowRuntimeOptions;
    runtime?: DuckFlowRuntime;
  }
) {
  const { runtimeOptions, runtime: providedRuntime, ...renderOptions } = options || {};

  const runtime = providedRuntime || createTestRuntime(runtimeOptions);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <DuckFlowProvider runtime={runtime}>{children}</DuckFlowProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  // Add cleanup for runtime if it was created internally
  if (!providedRuntime) {
    return {
      ...result,
      runtime,
      cleanup: () => {
        result.unmount();
        runtime.dispose();
      },
    };
  }

  return {
    ...result,
    runtime,
  };
}

/**
 * Detect legacy API usage in source code
 *
 * @param sourceCode - The source code to analyze
 * @returns Array of detected issues
 *
 * @example
 * ```typescript
 * const issues = detectLegacyAPIUsage(componentSource);
 * expect(issues).toHaveLength(0);
 * ```
 */
export function detectLegacyAPIUsage(sourceCode: string): string[] {
  const issues: string[] = [];

  // Check for deity imports
  if (/import\s+.*\bdeity\b.*from\s+['"]duck-flow['"]/.test(sourceCode)) {
    issues.push("Found deprecated deity import");
  }

  // Check for deity usage
  if (/\bdeity\./.test(sourceCode)) {
    issues.push("Found deprecated deity usage");
  }

  // Check for getDeity calls
  if (/\bgetDeity\s*\(/.test(sourceCode)) {
    issues.push("Found deprecated getDeity() call");
  }

  // Check for legacyDeity
  if (/\blegacyDeity\b/.test(sourceCode)) {
    issues.push("Found deprecated legacyDeity usage");
  }

  // Check for globalDuckFlowRuntime
  if (/\bglobalDuckFlowRuntime\b/.test(sourceCode)) {
    issues.push("Found deprecated globalDuckFlowRuntime usage");
  }

  return issues;
}

/**
 * Assert that code does not use legacy APIs
 *
 * @param sourceCode - The source code to check
 * @throws Error if legacy API usage is detected
 *
 * @example
 * ```typescript
 * test('component uses new API', () => {
 *   const source = fs.readFileSync('./WorkflowEditor.tsx', 'utf-8');
 *   assertNoLegacyAPI(source);
 * });
 * ```
 */
export function assertNoLegacyAPI(sourceCode: string): void {
  const issues = detectLegacyAPIUsage(sourceCode);

  if (issues.length > 0) {
    throw new Error(
      `Legacy API usage detected:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\n` +
        "Please migrate to the new API. See docs/api-unification-migration-guide.md"
    );
  }
}

/**
 * Mock DuckFlowRuntime for testing
 *
 * @param overrides - Partial runtime implementation to override
 * @returns Mocked runtime object
 *
 * @example
 * ```typescript
 * const mockRuntime = mockDuckFlowRuntime({
 *   createEntity: vi.fn(() => mockEntity),
 *   getEntity: vi.fn(() => mockEntity)
 * });
 * ```
 */
export function mockDuckFlowRuntime(overrides?: Partial<DuckFlowRuntime>): DuckFlowRuntime {
  const defaultMock: DuckFlowRuntime = {
    createEntity: vi.fn(),
    getEntity: vi.fn(),
    removeEntity: vi.fn(),
    hasEntity: vi.fn(),
    getAllEntities: vi.fn(() => []),
    render: vi.fn(),
    addEntityToRender: vi.fn(),
    removeEntityFromRender: vi.fn(),
    dispose: vi.fn(),
    registerManager: vi.fn(),
    getManager: vi.fn(),
    hasManager: vi.fn(),
    getRegisteredManagers: vi.fn(() => []),
    ...overrides,
  } as unknown as DuckFlowRuntime;

  return defaultMock;
}

/**
 * Wait for runtime to be ready
 *
 * @param runtime - The runtime instance
 * @param timeout - Maximum time to wait in ms (default: 5000)
 * @returns Promise that resolves when runtime is ready
 */
export async function waitForRuntimeReady(
  runtime: DuckFlowRuntime,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      // Check if runtime has essential managers
      if (runtime.hasManager("EntityManager") && runtime.hasManager("RenderManager")) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error("Timeout waiting for runtime to be ready"));
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}

// Auto-cleanup in global afterEach if available
if (typeof afterEach !== "undefined") {
  afterEach(() => {
    cleanupTestRuntimes();
  });
}
