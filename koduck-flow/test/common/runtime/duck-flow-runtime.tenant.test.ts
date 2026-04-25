import { describe, expect, it } from "vitest";

import {
  DuckFlowRuntime,
  createDuckFlowRuntime,
  resolveTenantContext,
  type DuckFlowTenantConfig,
} from "../../../src/common/runtime";
import { Entity, EntityRegistry } from "../../../src/common/entity";

const ENTITY_TYPE = "uml-usecase-canvas";

class TenantQuotaEntity extends Entity {
  static type = ENTITY_TYPE;
}

function registerTenantEntity(runtime: DuckFlowRuntime): void {
  const registry = new EntityRegistry(TenantQuotaEntity, undefined, { type: ENTITY_TYPE });
  runtime.EntityManager.registerEntityType(ENTITY_TYPE, registry);
}

function buildTenantConfig(partial?: Partial<DuckFlowTenantConfig>): DuckFlowTenantConfig {
  return {
    tenantId: "tenant-alpha",
    environment: "spec-env",
    quotas: {
      maxEntities: 1,
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
      stickyKey: "spec-seed",
    },
    ...partial,
  } satisfies DuckFlowTenantConfig;
}

describe("DuckFlowRuntime multi-tenant controls", () => {
  it("applies tenant context with quotas and feature flags", () => {
    const runtime = createDuckFlowRuntime();
    registerTenantEntity(runtime);
    const tenantConfig = buildTenantConfig();
    const resolved = resolveTenantContext(tenantConfig, {
      environment: tenantConfig.environment!,
      tenantId: tenantConfig.tenantId,
    });

    runtime.setTenantContext(resolved);

    const first = runtime.createEntity(ENTITY_TYPE);
    expect(first).not.toBeNull();

    const second = runtime.createEntity(ENTITY_TYPE);
    expect(second).toBeNull();

    if (first) {
      runtime.removeEntity(first.id);
    }

    const afterRemoval = runtime.createEntity(ENTITY_TYPE);
    expect(afterRemoval).not.toBeNull();

    expect(runtime.claimTenantQuota("workflows")).toBe(true);
    expect(runtime.claimTenantQuota("workflows")).toBe(true);
    expect(runtime.claimTenantQuota("workflows")).toBe(false);
    runtime.releaseTenantQuota("workflows");
    expect(runtime.claimTenantQuota("workflows")).toBe(true);

    const snapshots = runtime.listTenantQuotaSnapshots();
    expect(snapshots.find((snapshot) => snapshot.key === "__entities__")?.limit).toBe(1);

    expect(runtime.isTenantFeatureEnabled("beta-flow", false)).toBe(true);
    expect(runtime.isTenantFeatureEnabled("gray-ui", true)).toBe(false);

    runtime.setTenantContext(
      resolveTenantContext(
        buildTenantConfig({ rollout: { percentage: 0 } }),
        resolved.environmentKey
      )
    );
    expect(runtime.isTenantInRollout()).toBe(false);

    runtime.setTenantContext(
      resolveTenantContext(
        buildTenantConfig({ rollout: { percentage: 100 } }),
        resolved.environmentKey
      )
    );
    expect(runtime.isTenantInRollout("any-seed")).toBe(true);

    runtime.dispose();
  });
});
