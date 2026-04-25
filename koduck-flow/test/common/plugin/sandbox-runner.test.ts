import { describe, expect, it } from "vitest";
import {
  PluginLifecycleInvocationError,
  PluginLifecycleTimeoutError,
  PluginRegistrationError,
  PluginSandboxRunner,
} from "../../../src/common/plugin/sandbox-runner";

const API_NAME = "__duckFlowSandbox";

function createSandboxCode(body: string): string {
  return `
    const sandbox = globalThis.${API_NAME};
    if (!sandbox) {
      throw new Error("sandbox API missing");
    }
    ${body}
  `;
}

describe("PluginSandboxRunner", () => {
  it("executes lifecycle hooks in order", async () => {
    const harness = { events: [] as string[] };

    const code = createSandboxCode(`
      sandbox.register((helpers) => {
        return {
          onInit(context) {
            helpers.logger.debug({ event: "init" });
            helpers.registerCleanup(() => {
              globalThis.harness.events.push("cleanup");
            });
            globalThis.harness.events.push("init:" + context.value);
          },
          onAttach(context) {
            globalThis.harness.events.push("attach:" + context.host);
          },
          onDispose(reason) {
            globalThis.harness.events.push("dispose:" + reason);
          },
        };
      });
    `);

    const runner = new PluginSandboxRunner<{ value: string }, { host: string }, string>({
      id: "test-plugin",
      code,
      globals: { harness },
      apiName: API_NAME,
      timeoutMs: 200,
    });

    await runner.init({ value: "initPayload" });
    await runner.attach({ host: "canvas" });
    await runner.dispose("finished");

    expect(harness.events).toEqual([
      "init:initPayload",
      "attach:canvas",
      "dispose:finished",
      "cleanup",
    ]);
  });

  it("supports default module exports", async () => {
    const harness = { value: null as unknown };
    const code = `
      module.exports = {
        default: {
          onInit(ctx) {
            globalThis.harness.value = ctx;
          }
        }
      };
    `;

    const runner = new PluginSandboxRunner<{ flag: string }>({
      id: "module-export",
      code,
      globals: { harness },
      timeoutMs: 200,
    });

    await runner.init({ flag: "ok" });
    expect(harness.value).toEqual({ flag: "ok" });
    await runner.dispose();
  });

  it("throws when plugin does not register", async () => {
    const runner = new PluginSandboxRunner({
      id: "invalid-plugin",
      code: "module.exports = null;",
    });

    await expect(runner.init()).rejects.toBeInstanceOf(PluginRegistrationError);
  });

  it("wraps lifecycle errors", async () => {
    const code = createSandboxCode(`
      sandbox.register(() => ({
        onInit() {
          throw new Error("boom");
        }
      }));
    `);

    const runner = new PluginSandboxRunner({
      id: "failing-plugin",
      code,
      apiName: API_NAME,
      timeoutMs: 200,
    });

    await expect(runner.init()).rejects.toBeInstanceOf(PluginLifecycleInvocationError);
  });

  it("timeouts long running lifecycle", async () => {
    const code = createSandboxCode(`
      sandbox.register(() => ({
        async onAttach() {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }));
    `);

    const runner = new PluginSandboxRunner({
      id: "timeout-plugin",
      code,
      apiName: API_NAME,
      timeoutMs: 10,
    });

    await runner.init();
    await expect(runner.attach()).rejects.toBeInstanceOf(PluginLifecycleTimeoutError);
  });

  it("prevents multiple attachments", async () => {
    const code = createSandboxCode(`
      sandbox.register(() => ({ onAttach() {} }));
    `);

    const runner = new PluginSandboxRunner({
      id: "single-attach",
      code,
      apiName: API_NAME,
    });

    await runner.attach();
    await expect(runner.attach()).rejects.toThrowError(/already attached/);
    await runner.dispose();
  });
});
