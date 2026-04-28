import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

import {
  DuckFlowRuntimeController,
  resolveTenantContext,
  type DuckFlowRuntime,
  type DuckFlowTenantConfig,
  type DuckFlowRuntimeFactory,
  type ResolvedTenantContext,
  type RuntimeEnvironmentKey,
} from "../../../src/common/runtime";
import { DuckFlowProvider } from "../../../src/components/provider/DuckFlowProvider";
import { useDuckFlowContext } from "../../../src/components/provider/hooks/useDuckFlowRuntime";

const getRuntimeForKeyMock = vi.hoisted(() => vi.fn());
const createDuckFlowRuntimeMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/common/runtime", async () => {
  const actual = await vi.importActual<typeof import("../../../src/common/runtime")>(
    "../../../src/common/runtime"
  );
  return {
    ...actual,
    createDuckFlowRuntime: createDuckFlowRuntimeMock,
  };
});

vi.mock("../../../src/common/global-runtime", () => ({
  getRuntimeForKey: getRuntimeForKeyMock,
  DEFAULT_DUCKFLOW_ENVIRONMENT: "test-default",
}));

const setApiRuntimeMock = vi.hoisted(() => vi.fn());
const clearApiRuntimeMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/common/api", () => ({
  setApiRuntime: setApiRuntimeMock,
  clearApiRuntime: clearApiRuntimeMock,
}));

const loggerMock = vi.hoisted(() => {
  const createAdapter = () => {
    const adapter = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      time: vi.fn(),
      timeEnd: vi.fn(),
      withContext: vi.fn(),
      child: vi.fn(),
    };

    adapter.withContext.mockImplementation(() => createAdapter());
    adapter.child.mockImplementation(() => createAdapter());

    return adapter;
  };

  const root = createAdapter();
  root.withContext.mockImplementation(() => createAdapter());
  root.child.mockImplementation(() => createAdapter());
  return root;
});

vi.mock("../../../src/common/logger", () => ({
  logger: loggerMock,
}));

const debugPanelPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("../../../src/components/debug/DebugPanel", () => ({
  DebugPanel: (props: Record<string, unknown>) => {
    debugPanelPropsSpy(props);
    return null;
  },
}));

type RuntimeFixture = {
  runtime: DuckFlowRuntime;
  state: {
    tenant: ResolvedTenantContext | null;
  };
  spies: {
    configureDebug: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    setTenantContext: ReturnType<typeof vi.fn>;
  };
};

const ContextProbe: React.FC = () => {
  const context = useDuckFlowContext();
  return (
    <div>
      <span data-testid="context-source">{context.source}</span>
      <span data-testid="context-tenant">{context.tenant?.tenantId ?? "none"}</span>
      <span data-testid="context-environment">
        {context.environment
          ? `${context.environment.environment}:${context.environment.tenantId ?? ""}`
          : "none"}
      </span>
    </div>
  );
};

function createRuntimeFixture(id = "runtime-ut"): RuntimeFixture {
  const state = {
    tenant: null as ResolvedTenantContext | null,
  };

  const configureDebug = vi.fn();
  const dispose = vi.fn();
  const setTenantContext = vi.fn((tenant: ResolvedTenantContext | null) => {
    state.tenant = tenant;
  });

  const runtime = {
    id,
    configureDebug,
    dispose,
    setTenantContext,
    getTenantContext: vi.fn(() => state.tenant ?? undefined),
    isTenantFeatureEnabled: vi.fn((flag: string, defaultValue = false) => {
      return state.tenant?.rollout?.features?.[flag] ?? defaultValue;
    }),
    isTenantInRollout: vi.fn(() => Boolean(state.tenant?.rollout)),
  } as unknown as DuckFlowRuntime;

  return {
    runtime,
    state,
    spies: {
      configureDebug,
      dispose,
      setTenantContext,
    },
  };
}

function createTenantConfig(
  tenantId: string,
  environment: string,
  overrides: Partial<DuckFlowTenantConfig> = {}
): DuckFlowTenantConfig {
  return {
    tenantId,
    environment,
    displayName: `${tenantId}-display`,
    quotas: {
      maxEntities: 5,
    },
    rollout: {
      percentage: 100,
      features: {
        "beta-flow": true,
      },
    },
    ...overrides,
  } satisfies DuckFlowTenantConfig;
}

function resolveTenant(
  config: DuckFlowTenantConfig,
  environment?: RuntimeEnvironmentKey
): ResolvedTenantContext {
  const env: RuntimeEnvironmentKey =
    environment ??
    ({
      environment: config.environment ?? "default",
      tenantId: config.tenantId,
    } satisfies RuntimeEnvironmentKey);
  return resolveTenantContext(config, env);
}

beforeEach(() => {
  setApiRuntimeMock.mockReset();
  clearApiRuntimeMock.mockReset();
  getRuntimeForKeyMock.mockReset();
  createDuckFlowRuntimeMock.mockReset();
  debugPanelPropsSpy.mockClear();
  loggerMock.debug.mockClear();
  loggerMock.info.mockClear();
  loggerMock.warn.mockClear();
  loggerMock.error.mockClear();
  loggerMock.time.mockClear();
  loggerMock.timeEnd.mockClear();
  loggerMock.withContext.mockClear();
  loggerMock.child.mockClear();
});

describe("DuckFlowProvider (uncontrolled)", () => {
  it("pushes runtime metadata to API context and disposes on unmount", async () => {
    const token = Symbol("api-runtime-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const { runtime, state } = createRuntimeFixture();
    const tenantConfig = createTenantConfig("tenant-ut", "staging");
    const onInit = vi.fn();
    const onTenantInit = vi.fn();
    const onDispose = vi.fn();

    const { unmount } = render(
      <DuckFlowProvider
        runtime={runtime}
        tenant={tenantConfig}
        environment="staging"
        debugOptions={{
          enabled: true,
          panel: { enabled: true, defaultOpen: true, position: "left" },
          eventTracking: true,
        }}
        disposeOnUnmount
        onInit={onInit}
        onTenantInit={onTenantInit}
        onDispose={onDispose}
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(runtime.configureDebug).toHaveBeenCalledWith({
        enabled: true,
        panel: { enabled: true, defaultOpen: true, position: "left" },
        eventTracking: true,
      });
    });

    await waitFor(() => {
      const resolvedTenant = state.tenant;
      expect(resolvedTenant?.tenantId).toBe("tenant-ut");
      expect(resolvedTenant?.environment).toBe("staging");
    });

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledWith(runtime);
    });

    expect(setApiRuntimeMock).toHaveBeenCalledWith(runtime, {
      source: "prop",
      environment: expect.objectContaining({ environment: "staging", tenantId: "tenant-ut" }),
      tenantId: "tenant-ut",
      tenant: expect.objectContaining({ tenantId: "tenant-ut" }),
    });

    expect(screen.getByTestId("context-source").textContent).toBe("prop");
    expect(screen.getByTestId("context-tenant").textContent).toBe("tenant-ut");
    expect(screen.getByTestId("context-environment").textContent).toBe("staging:tenant-ut");
    expect(debugPanelPropsSpy).toHaveBeenCalledWith({
      defaultOpen: true,
      position: "left",
      eventTracking: true,
    });

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
    expect(onDispose).toHaveBeenCalledWith(runtime);
  });

  it("updates tenant context and clears it when tenant is removed", async () => {
    const { runtime, state } = createRuntimeFixture("runtime-switch");
    const onTenantInit = vi.fn();
    const { rerender } = render(
      <DuckFlowProvider
        runtime={runtime}
        tenant={createTenantConfig("tenant-a", "qa")}
        onTenantInit={onTenantInit}
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(state.tenant?.tenantId).toBe("tenant-a");
    });

    expect(onTenantInit).not.toHaveBeenCalled();

    rerender(
      <DuckFlowProvider
        runtime={runtime}
        tenant={createTenantConfig("tenant-b", "qa")}
        onTenantInit={onTenantInit}
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(state.tenant?.tenantId).toBe("tenant-b");
    });

    await waitFor(() => {
      expect(onTenantInit).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DuckFlowProvider runtime={runtime} tenant={undefined} onTenantInit={onTenantInit}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(state.tenant).toBeNull();
    });

    expect(onTenantInit).toHaveBeenCalledTimes(1);
    expect(runtime.setTenantContext).toHaveBeenCalledWith(null);
    expect(clearApiRuntimeMock).not.toHaveBeenCalled();
  });

  it("reuses global runtime when provided only with environment key", async () => {
    const token = Symbol("global-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const globalFixture = createRuntimeFixture("runtime-global");
    getRuntimeForKeyMock.mockReturnValue(globalFixture.runtime);

    const { unmount } = render(
      <DuckFlowProvider environment={{ environment: "qa", tenantId: "tenant-shared" }}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(getRuntimeForKeyMock).toHaveBeenCalledWith(
        { environment: "qa", tenantId: "tenant-shared" },
        undefined
      );
    });

    expect(screen.getByTestId("context-source").textContent).toBe("global");
    expect(screen.getByTestId("context-tenant").textContent).toBe("none");
    expect(screen.getByTestId("context-environment").textContent).toBe("qa:tenant-shared");

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
    expect(globalFixture.spies.dispose).not.toHaveBeenCalled();
  });

  it("disposes factory runtime when reuse is disabled", async () => {
    const token = Symbol("factory-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const factoryRuntime = createRuntimeFixture("runtime-factory");
    const factoryImpl = {
      getOrCreateRuntime: vi.fn(() => factoryRuntime.runtime),
      disposeRuntime: vi.fn(),
      hasRuntime: vi.fn(() => true),
    };
    const factory = factoryImpl as unknown as DuckFlowRuntimeFactory;
    const tenantConfig = createTenantConfig("tenant-factory", "factory-env");
    const options = {
      metadata: { existing: "value" },
      mode: "strict" as const,
    };

    const { unmount } = render(
      <DuckFlowProvider
        factory={factory}
        environment={{ environment: "factory-env", tenantId: "tenant-factory" }}
        tenant={tenantConfig}
        options={options}
        reuse={false}
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(factoryImpl.getOrCreateRuntime).toHaveBeenCalledWith(
        { environment: "factory-env", tenantId: "tenant-factory" },
        expect.objectContaining({
          mode: "strict",
          metadata: expect.objectContaining({
            existing: "value",
            tenantId: tenantConfig.tenantId,
            tenantDisplayName: tenantConfig.displayName,
          }),
        })
      );
    });

    expect(factoryImpl.disposeRuntime).toHaveBeenCalledWith({
      environment: "factory-env",
      tenantId: "tenant-factory",
    });

    unmount();

    expect(factoryImpl.disposeRuntime).toHaveBeenCalledTimes(2);
    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("warns when tenant configuration lacks tenantId", async () => {
    const token = Symbol("tenant-warning");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-warning");

    const { unmount } = render(
      <DuckFlowProvider
        runtime={fixture.runtime}
        tenant={{ tenantId: "  ", environment: "dev" }}
        environment="dev"
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("context-tenant").textContent?.trim()).toBe("");
      expect(screen.getByTestId("context-environment").textContent).toBe("dev:");
    });

    expect(loggerMock.warn).toHaveBeenCalledWith(
      "DuckFlowProvider received tenant configuration without tenantId; tenant context will be ignored."
    );

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("enables debug panel when only the enabled flag is specified", () => {
    const token = Symbol("debug-flag-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-debug-flag");

    const { unmount } = render(
      <DuckFlowProvider runtime={fixture.runtime} debugOptions={{ enabled: true }}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    expect(debugPanelPropsSpy).toHaveBeenCalledWith({
      defaultOpen: false,
      position: "right",
      eventTracking: false,
    });

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("warns when environment tenantId mismatches the tenant configuration", async () => {
    const token = Symbol("mismatch-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-mismatch");
    const tenantConfig = createTenantConfig("tenant-normalized", "cerulean");

    const { unmount } = render(
      <DuckFlowProvider
        runtime={fixture.runtime}
        tenant={tenantConfig}
        environment={{ environment: "cerulean", tenantId: "different-tenant" }}
      >
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(loggerMock.warn).toHaveBeenCalledWith(
        "DuckFlowProvider tenantId mismatch between environment prop and tenant config. Using tenant configuration value.",
        {
          environmentTenant: "different-tenant",
          tenantId: "tenant-normalized",
        }
      );
    });

    expect(screen.getByTestId("context-tenant").textContent).toBe("tenant-normalized");

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("creates a local runtime when no runtime or environment is provided", async () => {
    const token = Symbol("local-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-local");
    const options = { metadata: { hint: "local" } };
    createDuckFlowRuntimeMock.mockReturnValueOnce(fixture.runtime);

    const { unmount } = render(
      <DuckFlowProvider lazy disposeOnUnmount options={options}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    expect(createDuckFlowRuntimeMock).toHaveBeenCalledWith(options);
    expect(screen.getByTestId("context-source").textContent).toBe("local");
    expect(screen.getByTestId("context-environment").textContent).toBe("none");

    expect(loggerMock.debug).toHaveBeenCalledWith(
      "DuckFlowProvider created new runtime instance",
      expect.objectContaining({ source: "local", lazy: true })
    );
    expect(loggerMock.debug).toHaveBeenCalledWith(
      "DuckFlowProvider lazily prepared local runtime instance"
    );

    unmount();

    expect(fixture.spies.dispose).toHaveBeenCalledTimes(1);
    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("warns when runtime prop changes after the initial mount", async () => {
    const token = Symbol("prop-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const initialRuntime = createRuntimeFixture("runtime-prop-initial");
    const updatedRuntime = createRuntimeFixture("runtime-prop-updated");

    const { rerender, unmount } = render(
      <DuckFlowProvider runtime={initialRuntime.runtime}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    rerender(
      <DuckFlowProvider runtime={updatedRuntime.runtime}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(loggerMock.warn).toHaveBeenCalledWith(
        "DuckFlowProvider does not support changing the runtime prop after mount. The initial instance will be used."
      );
    });

    expect(screen.getByTestId("context-source").textContent).toBe("prop");
    expect(setApiRuntimeMock).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });
});

describe("DuckFlowProvider (controlled)", () => {
  it("propagates controller snapshot updates and tears down previous API token", async () => {
    const tokenA = Symbol("token-a");
    const tokenB = Symbol("token-b");
    setApiRuntimeMock.mockReturnValueOnce(tokenA).mockReturnValueOnce(tokenB);

    const primary = createRuntimeFixture("runtime-primary");
    const secondary = createRuntimeFixture("runtime-secondary");

    const tenantA = resolveTenant(createTenantConfig("tenant-controller-a", "blue"));
    const tenantB = resolveTenant(createTenantConfig("tenant-controller-b", "green"));
    const controller = new DuckFlowRuntimeController({
      initialRuntime: primary.runtime,
      initialTenant: tenantA,
      initialEnvironment: tenantA.environmentKey,
      initialSource: "controller-external",
      disposePreviousOnSwitch: false,
    });

    const onInit = vi.fn();
    const onTenantInit = vi.fn();

    const { unmount } = render(
      <DuckFlowProvider controller={controller} onInit={onInit} onTenantInit={onTenantInit}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledWith(primary.runtime);
    });

    expect(setApiRuntimeMock).toHaveBeenCalledWith(primary.runtime, {
      source: "controller-external",
      tenant: tenantA,
      tenantId: tenantA.tenantId,
      environment: tenantA.environmentKey,
    });

    expect(onTenantInit).not.toHaveBeenCalled();

    act(() => {
      controller.setRuntime(secondary.runtime, {
        tenant: tenantB,
        environment: tenantB.environmentKey,
        source: "controller-factory",
        disposePrevious: false,
      });
    });

    await waitFor(() => {
      expect(onInit).toHaveBeenLastCalledWith(secondary.runtime);
    });

    await waitFor(() => {
      expect(onTenantInit).toHaveBeenCalledWith(secondary.runtime, tenantB);
    });

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(tokenA);
    expect(setApiRuntimeMock).toHaveBeenLastCalledWith(secondary.runtime, {
      source: "controller-factory",
      tenant: tenantB,
      tenantId: tenantB.tenantId,
      environment: tenantB.environmentKey,
    });

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenLastCalledWith(tokenB);
  });

  it("applies tenant props when controller snapshot omits tenant", async () => {
    const token = Symbol("token-tenant-prop");
    setApiRuntimeMock.mockReturnValue(token);

    const { runtime, state } = createRuntimeFixture("runtime-props");
    const tenantConfig = createTenantConfig("tenant-prop", "amber");
    const resolved = resolveTenant(tenantConfig);

    const controller = new DuckFlowRuntimeController({
      initialRuntime: runtime,
      initialSource: "controller",
      disposePreviousOnSwitch: false,
    });

    render(
      <DuckFlowProvider controller={controller} tenant={tenantConfig}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(state.tenant?.tenantId).toBe("tenant-prop");
    });

    expect(runtime.setTenantContext).toHaveBeenCalledWith(resolved);
    expect(clearApiRuntimeMock).not.toHaveBeenCalled();
  });

  it("enables debug panel in controlled mode with only the enabled flag", () => {
    const token = Symbol("controller-debug-token");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-controller-debug");
    const controller = new DuckFlowRuntimeController({
      initialRuntime: fixture.runtime,
      initialSource: "controller-external",
      disposePreviousOnSwitch: false,
    });

    const { unmount } = render(
      <DuckFlowProvider controller={controller} debugOptions={{ enabled: true }}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    expect(debugPanelPropsSpy).toHaveBeenCalledWith({
      defaultOpen: false,
      position: "right",
      eventTracking: false,
    });

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("warns when controlled tenant configuration lacks tenantId", async () => {
    const token = Symbol("controller-tenant-warning");
    setApiRuntimeMock.mockReturnValueOnce(token);

    const fixture = createRuntimeFixture("runtime-controller-warning");
    const controller = new DuckFlowRuntimeController({
      initialRuntime: fixture.runtime,
      initialSource: "controller",
      disposePreviousOnSwitch: false,
    });

    const { unmount } = render(
      <DuckFlowProvider controller={controller} tenant={{ tenantId: "  ", environment: "emerald" }}>
        <ContextProbe />
      </DuckFlowProvider>
    );

    await waitFor(() => {
      expect(loggerMock.warn).toHaveBeenCalledWith(
        "DuckFlowProvider (controlled) received tenant configuration without tenantId; tenant context will be ignored."
      );
    });

    unmount();

    expect(clearApiRuntimeMock).toHaveBeenCalledWith(token);
  });

  it("throws when controller snapshot does not provide a runtime", () => {
    const controller = new DuckFlowRuntimeController();

    expect(() =>
      render(
        <DuckFlowProvider controller={controller}>
          <ContextProbe />
        </DuckFlowProvider>
      )
    ).toThrowError(
      /DuckFlowProvider \(controlled\) requires the controller to supply an active runtime instance/
    );
  });
});

describe("useDuckFlowContext", () => {
  it("throws when accessed outside of a provider", () => {
    const TestComponent = () => {
      useDuckFlowContext();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrowError(
      /DuckFlow context is unavailable\. Wrap your component tree in DuckFlowProvider/
    );
  });
});
