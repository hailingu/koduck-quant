import { describe, expect, it, afterEach } from "vitest";

import {
  DuckFlowRuntimeFactory,
  createDuckFlowRuntime,
  createScopedRuntime,
} from "./index";
import type { RuntimeEnvironmentKey } from "./index";

const createdRuntimes: { runtime: ReturnType<typeof createDuckFlowRuntime> }[] =
  [];

function track(runtime: ReturnType<typeof createDuckFlowRuntime>) {
  createdRuntimes.push({ runtime });
  return runtime;
}

afterEach(() => {
  while (createdRuntimes.length) {
    const { runtime } = createdRuntimes.pop()!;
    runtime.dispose();
  }
});

describe("DuckFlowRuntimeFactory", () => {
  it("reuses runtime for identical environment keys", () => {
    const factory = new DuckFlowRuntimeFactory();
    const key: RuntimeEnvironmentKey = { environment: "test-env" };

    const first = track(factory.getOrCreateRuntime(key));
    const second = factory.getOrCreateRuntime(key);

    expect(second).toBe(first);
  });

  it("creates isolated runtimes for different environments", () => {
    const factory = new DuckFlowRuntimeFactory();
    const first = track(factory.getOrCreateRuntime({ environment: "env-a" }));
    const second = track(factory.getOrCreateRuntime({ environment: "env-b" }));

    expect(second).not.toBe(first);
    expect(second.RegistryManager).not.toBe(first.RegistryManager);
  });

  it("creates new runtime after disposing previous instance", () => {
    const factory = new DuckFlowRuntimeFactory();
    const key: RuntimeEnvironmentKey = { environment: "test-env" };

    const first = track(factory.getOrCreateRuntime(key));
    factory.disposeRuntime(key);
    const second = track(factory.getOrCreateRuntime(key));

    expect(second).not.toBe(first);
  });
});

describe("createScopedRuntime", () => {
  it("registers core managers in scoped container", () => {
    const parent = track(createDuckFlowRuntime());
    const scoped = track(createScopedRuntime(parent));

    expect(scoped.RegistryManager).not.toBe(parent.RegistryManager);
    expect(scoped.RenderManager).not.toBe(parent.RenderManager);
    expect(scoped.EntityManager).not.toBe(parent.EntityManager);
  });
});
