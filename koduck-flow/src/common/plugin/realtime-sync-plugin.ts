import type { PluginLifecycle } from "./sandbox-runner";

type RealtimeSyncPluginMetadata = {
  readonly featureFlag?: string;
};

type RealtimeSyncPluginInitContext = {
  readonly metadata: RealtimeSyncPluginMetadata;
};

type RealtimeSyncPluginAttachContext = {
  readonly runtimeId: string;
};

type RealtimeSyncPluginDisposeContext = {
  readonly reason?: string;
};

export function createRealtimeSyncPlugin(): PluginLifecycle<
  RealtimeSyncPluginInitContext,
  RealtimeSyncPluginAttachContext,
  RealtimeSyncPluginDisposeContext
> {
  return {
    async onInit(context) {
      if (context?.metadata?.featureFlag) {
        console.debug("[RealtimeSyncPlugin] init feature flag", context.metadata.featureFlag);
      }
    },
    async onAttach(context) {
      console.info("[RealtimeSyncPlugin] attached to runtime", context?.runtimeId);
    },
    async onDispose(context?: RealtimeSyncPluginDisposeContext) {
      console.info("[RealtimeSyncPlugin] disposed", context?.reason ?? "normal");
    },
  } satisfies PluginLifecycle<
    RealtimeSyncPluginInitContext,
    RealtimeSyncPluginAttachContext,
    RealtimeSyncPluginDisposeContext
  >;
}
