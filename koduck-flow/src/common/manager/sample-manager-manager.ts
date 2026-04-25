import type { IManager } from "../runtime";

export class SampleManagerManager implements IManager {
  readonly name = "sampleManager";
  readonly type = "sample-manager";

  private initialized = false;
  private services: Map<string, unknown> = new Map();

  initialize(): void {
    // Wire runtime managers or register services
    this.services.set("logger", console);
    this.services.set("config", { enabled: true });
    this.initialized = true;
  }

  dispose(): void {
    // Clean up resources allocated during initialize
    this.services.clear();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getService(name: string): unknown {
    return this.services.get(name);
  }
}
