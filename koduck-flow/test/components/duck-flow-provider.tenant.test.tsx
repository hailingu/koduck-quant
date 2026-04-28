import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { getApiRuntimeInfo } from "../../src/common/api/runtime-context";
import {
  DuckFlowRuntimeController,
  DuckFlowRuntimeFactory,
  createDuckFlowRuntime,
  type DuckFlowTenantConfig,
} from "../../src/common/runtime";
import { DuckFlowProvider } from "../../src/components/provider/DuckFlowProvider";
import {
  useDuckFlowContext,
  useDuckFlowRuntime,
  useDuckFlowTenant,
  useTenantFeatureFlag,
  useTenantRollout,
} from "../../src/components/provider/hooks/useDuckFlowRuntime";

const TenantProbe: React.FC = () => {
  const tenant = useDuckFlowTenant();
  const runtime = useDuckFlowRuntime();
  const betaEnabled = useTenantFeatureFlag("beta-flow", false);
  const rolloutActive = useTenantRollout("probe-seed");

  return (
    <div>
      <span data-testid="tenant-id">{tenant?.tenantId ?? "none"}</span>
      <span data-testid="runtime-tenant">{runtime.getTenantContext()?.tenantId ?? "none"}</span>
      <span data-testid="feature-beta">{betaEnabled ? "on" : "off"}</span>
      <span data-testid="rollout-active">{rolloutActive ? "yes" : "no"}</span>
    </div>
  );
};

const ContextProbe: React.FC = () => {
  const { source, environment } = useDuckFlowContext();
  return (
    <div>
      <span data-testid="context-source">{source}</span>
      <span data-testid="context-environment">
        {environment ? `${environment.environment}:${environment.tenantId ?? "none"}` : "none"}
      </span>
    </div>
  );
};

function buildTenantConfig(partial?: Partial<DuckFlowTenantConfig>): DuckFlowTenantConfig {
  return {
    tenantId: "tenant-alpha",
    environment: "spec-env",
    displayName: "Spec Tenant",
    quotas: {
      maxEntities: 3,
      custom: {
        workflows: 2,
      },
    },
    rollout: {
      percentage: 100,
      features: {
        "beta-flow": true,
        "gray-ui": false,
      },
      stickyKey: "spec-key",
    },
    ...partial,
  } satisfies DuckFlowTenantConfig;
}

afterEach(() => {
  cleanup();
});

describe("DuckFlowProvider multi-tenant wiring", () => {
  it("provides tenant context and feature gating", () => {
    render(
      <DuckFlowProvider
        tenant={{
          tenantId: "tenant-test",
          environment: "qa",
          displayName: "QA Tenant",
          quotas: {
            maxEntities: 5,
          },
          rollout: {
            percentage: 100,
            features: {
              "beta-flow": true,
            },
          },
        }}
      >
        <TenantProbe />
      </DuckFlowProvider>
    );

    expect(screen.getByTestId("tenant-id").textContent).toBe("tenant-test");
    expect(screen.getByTestId("runtime-tenant").textContent).toBe("tenant-test");
    expect(screen.getByTestId("feature-beta").textContent).toBe("on");
    expect(screen.getByTestId("rollout-active").textContent).toBe("yes");

    const apiInfo = getApiRuntimeInfo();
    expect(apiInfo.tenantId).toBe("tenant-test");
    expect(apiInfo.tenant?.tenantId).toBe("tenant-test");
    expect(apiInfo.tenant?.quotas?.maxEntities).toBe(5);
  });
});

describe("DuckFlowProvider controlled mode", () => {
  it("consumes runtime and metadata from the controller snapshot", () => {
    const tenantConfig = buildTenantConfig({
      tenantId: "tenant-controller-alpha",
      environment: "controller-alpha",
      displayName: "Controller Alpha",
    });
    const runtime = createDuckFlowRuntime();
    const controller = new DuckFlowRuntimeController({
      initialRuntime: runtime,
      initialEnvironment: {
        environment: tenantConfig.environment!,
        tenantId: tenantConfig.tenantId,
      },
      initialTenant: tenantConfig,
      initialMetadata: {
        label: "alpha",
      },
    });

    render(
      <DuckFlowProvider controller={controller}>
        <TenantProbe />
        <ContextProbe />
      </DuckFlowProvider>
    );

    expect(screen.getByTestId("tenant-id").textContent).toBe("tenant-controller-alpha");
    expect(screen.getByTestId("runtime-tenant").textContent).toBe("tenant-controller-alpha");
    expect(screen.getByTestId("feature-beta").textContent).toBe("on");
    expect(screen.getByTestId("rollout-active").textContent).toBe("yes");
    expect(screen.getByTestId("context-source").textContent).toBe("controller-external");
    expect(screen.getByTestId("context-environment").textContent).toBe(
      "controller-alpha:tenant-controller-alpha"
    );

    const apiInfo = getApiRuntimeInfo();
    expect(apiInfo.isLegacyFallback).toBe(false);
    expect(apiInfo.source).toBe("controller-external");
    expect(apiInfo.environment?.environment).toBe("controller-alpha");
    expect(apiInfo.environment?.tenantId).toBe("tenant-controller-alpha");
    expect(apiInfo.tenantId).toBe("tenant-controller-alpha");
    expect(apiInfo.tenant?.tenantId).toBe("tenant-controller-alpha");
  });

  it("hot switches runtime when controller changes environment", async () => {
    const factory = new DuckFlowRuntimeFactory();
    const initialKey = {
      environment: "controller-alpha",
      tenantId: "tenant-controller-alpha",
    } as const;
    const initialTenant = buildTenantConfig({
      tenantId: initialKey.tenantId,
      environment: initialKey.environment,
      displayName: "Controller Alpha",
    });
    const initialRuntime = factory.getOrCreateRuntime(initialKey);
    const controller = new DuckFlowRuntimeController({
      factory,
      initialRuntime,
      initialEnvironment: initialKey,
      initialTenant,
      initialMetadata: {
        label: "alpha",
      },
    });

    render(
      <DuckFlowProvider controller={controller}>
        <TenantProbe />
        <ContextProbe />
      </DuckFlowProvider>
    );

    expect(screen.getByTestId("tenant-id").textContent).toBe("tenant-controller-alpha");
    expect(screen.getByTestId("context-source").textContent).toBe("controller-external");

    const nextKey = {
      environment: "controller-beta",
      tenantId: "tenant-controller-beta",
    } as const;
    const nextTenant = buildTenantConfig({
      tenantId: nextKey.tenantId,
      environment: nextKey.environment,
      displayName: "Controller Beta",
      rollout: {
        percentage: 0,
        features: {
          "beta-flow": false,
        },
      },
    });

    await act(async () => {
      controller.switchToEnvironment(nextKey, {
        tenant: nextTenant,
        metadata: {
          label: "beta",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("tenant-id").textContent).toBe("tenant-controller-beta");
      expect(screen.getByTestId("runtime-tenant").textContent).toBe("tenant-controller-beta");
      expect(screen.getByTestId("feature-beta").textContent).toBe("off");
      expect(screen.getByTestId("rollout-active").textContent).toBe("no");
      expect(screen.getByTestId("context-source").textContent).toBe("controller-factory");
      expect(screen.getByTestId("context-environment").textContent).toBe(
        "controller-beta:tenant-controller-beta"
      );
    });

    await waitFor(() => {
      const apiInfo = getApiRuntimeInfo();
      expect(apiInfo.source).toBe("controller-factory");
      expect(apiInfo.tenantId).toBe("tenant-controller-beta");
      expect(apiInfo.tenant?.tenantId).toBe("tenant-controller-beta");
      expect(apiInfo.environment?.environment).toBe("controller-beta");
      expect(apiInfo.environment?.tenantId).toBe("tenant-controller-beta");
    });

    const currentRuntime = controller.getRuntime();
    expect(currentRuntime).not.toBeNull();
    expect(currentRuntime).not.toBe(initialRuntime);
    expect(currentRuntime?.getTenantContext()?.tenantId).toBe("tenant-controller-beta");
  });
});
