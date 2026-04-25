import { describe, expect, it } from "vitest";
import { SampleManagerManager } from "../../../src/common/manager/sample-manager-manager";

describe("SampleManagerManager", () => {
  it("exposes metadata", () => {
    const manager = new SampleManagerManager();

    expect(manager.name).toBe("sampleManager");
    expect(manager.type).toBe("sample-manager");
  });

  it("initializes and registers services", () => {
    const manager = new SampleManagerManager();

    expect(manager.isInitialized()).toBe(false);

    manager.initialize();

    expect(manager.isInitialized()).toBe(true);
    expect(manager.getService("logger")).toBe(console);
    expect(manager.getService("config")).toEqual({ enabled: true });
  });

  it("disposes and cleans up resources", () => {
    const manager = new SampleManagerManager();

    manager.initialize();
    expect(manager.isInitialized()).toBe(true);

    manager.dispose();

    expect(manager.isInitialized()).toBe(false);
    expect(manager.getService("logger")).toBeUndefined();
  });
});
