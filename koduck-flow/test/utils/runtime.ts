import type { IDependencyContainer } from "../../src/common/di/types";
import {
  createCoreContainer,
  type CoreServiceOverrides,
} from "../../src/common/di/bootstrap";
import {
  KoduckFlowRuntime,
  createKoduckFlowRuntime,
} from "../../src/common/runtime";

export interface TestRuntimeOptions {
  /**
   * Override core service registrations (entityManager, renderManager, etc.).
   */
  overrides?: CoreServiceOverrides;
  /**
   * Provide a pre-configured container. Overrides will be applied on top.
   */
  container?: IDependencyContainer;
  /**
   * Callback to mutate the container before the runtime is materialized.
   */
  setup?: (container: IDependencyContainer) => void;
}

/**
 * Create a fresh KoduckFlow runtime for tests. Each invocation constructs a new
 * dependency container to guarantee isolation between test cases. Use
 * `overrides` to inject mocks for core services such as EntityManager or
 * RenderManager. The caller is responsible for disposing the returned runtime
 * (typically in `afterEach`).
 */
export function createTestRuntime(
  options: TestRuntimeOptions = {}
): KoduckFlowRuntime {
  const { overrides, setup } = options;

  const normalizedOverrides = overrides
    ? (Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => {
          if (!value) return [key, value];
          if ("instance" in value && value.instance !== undefined) {
            return [
              key,
              {
                ...value,
                ownsInstance: value.ownsInstance ?? false,
              },
            ];
          }
          return [key, value];
        })
      ) as CoreServiceOverrides)
    : undefined;

  const container =
    options.container ?? createCoreContainer(normalizedOverrides);

  setup?.(container);

  return createKoduckFlowRuntime({ container, overrides: normalizedOverrides });
}
