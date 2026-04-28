import { describe, expect, it, afterEach } from "vitest";

import {
  KoduckFlowRuntimeFactory,
  createKoduckFlowRuntime,
  createScopedRuntime,
} from "./index";
import type { RuntimeEnvironmentKey } from "./index";

const createdRuntimes: { runtime: ReturnType<typeof createKoduckFlowRuntime> }[] =
  [];

function track(runtime: ReturnType<typeof createKoduckFlowRuntime>) {
  createdRuntimes.push({ runtime });
  return runtime;
}

afterEach(() => {
  while (createdRuntimes.length) {
    const { runtime } = createdRuntimes.pop()!;
    runtime.dispose();
  }
});

describe("KoduckFlowRuntimeFactory", () => {
  it("reuses runtime for identical environment keys", () => {
    const factory = new KoduckFlowRuntimeFactory();
    const key: RuntimeEnvironmentKey = { environment: "test-env" };

    const first = track(factory.getOrCreateRuntime(key));
    const second = factory.getOrCreateRuntime(key);

    expect(second).toBe(first);
  });

  it("creates isolated runtimes for different environments", () => {
    const factory = new KoduckFlowRuntimeFactory();
    const first = track(factory.getOrCreateRuntime({ environment: "env-a" }));
    const second = track(factory.getOrCreateRuntime({ environment: "env-b" }));

    expect(second).not.toBe(first);
    expect(second.RegistryManager).not.toBe(first.RegistryManager);
  });

  it("creates new runtime after disposing previous instance", () => {
    const factory = new KoduckFlowRuntimeFactory();
    const key: RuntimeEnvironmentKey = { environment: "test-env" };

    const first = track(factory.getOrCreateRuntime(key));
    factory.disposeRuntime(key);
    const second = track(factory.getOrCreateRuntime(key));

    expect(second).not.toBe(first);
  });
});

describe("createScopedRuntime", () => {
  it("registers core managers in scoped container", () => {
    const parent = track(createKoduckFlowRuntime());
    const scoped = track(createScopedRuntime(parent));

    expect(scoped.RegistryManager).not.toBe(parent.RegistryManager);
    expect(scoped.RenderManager).not.toBe(parent.RenderManager);
    expect(scoped.EntityManager).not.toBe(parent.EntityManager);
  });
});
