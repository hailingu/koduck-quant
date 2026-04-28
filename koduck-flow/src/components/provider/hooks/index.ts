/**
 * @module src/components/provider/hooks
 * @description Collection of React hooks for KoduckFlow component development.
 * Provides convenient access to runtime, entity management, and flow operations.
 *
 * These hooks leverage the runtime and common API to provide a clean,
 * unified interface for React components to interact with the KoduckFlow framework.
 */

import { useEntity } from "./useEntity";
import { useFlow } from "./useFlow";

export { useEntity } from "./useEntity";
export type { UseEntityOptions, UseEntityResult } from "./useEntity";

export { useFlow } from "./useFlow";
export type { UseFlowOptions, UseFlowResult } from "./useFlow";

export {
  useKoduckFlowContext,
  useKoduckFlowRuntime,
  useKoduckFlowManagers,
  useKoduckFlowManager,
  useKoduckFlowTenant,
  useTenantFeatureFlag,
  useTenantRollout,
} from "./useKoduckFlowRuntime";

/**
 * Composite hook combining entity, flow, and rendering management.
 * Simplifies common workflows by integrating multiple hooks together.
 *
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.autoRender] - Enable automatic rendering
 * @param {boolean} [options.autoCleanup] - Enable automatic cleanup on unmount
 * @param {Object} [options.flowConfig] - Flow-specific configuration
 * @param {boolean} [options.flowConfig.autoCreateAST] - Auto-create AST from flow
 * @param {boolean} [options.flowConfig.autoRegisterNodeType] - Auto-register node types
 * @returns {Object} Combined hook result with entity and flow management
 *
 * @example
 * const koduckFlow = useKoduckFlow({
 *   autoRender: true,
 *   autoCleanup: true,
 *   flowConfig: {
 *     autoCreateAST: true
 *   }
 * });
 *
 * // Create and render a node
 * const node = koduckFlow.createAndRenderNode('StartNode', { x: 100, y: 100 });
 */
export function useKoduckFlow(
  options: {
    autoRender?: boolean;
    autoCleanup?: boolean;
    flowConfig?: {
      autoCreateAST?: boolean;
      autoRegisterNodeType?: boolean;
    };
  } = {}
) {
  const { autoRender = true, autoCleanup = true, flowConfig } = options;

  const entity = useEntity({
    autoRender,
    autoCleanup,
  });

  const flow = useFlow({
    ...(flowConfig?.autoCreateAST !== undefined && {
      autoCreateAST: flowConfig.autoCreateAST,
    }),
    ...(flowConfig?.autoRegisterNodeType !== undefined && {
      autoRegisterNodeType: flowConfig.autoRegisterNodeType,
    }),
  });

  // 组合方法：添加流程节点并渲染
  const addFlowNodeAndRender = async (config: {
    name: string;
    type: string;
    color?: string;
    position?: { x: number; y: number };
  }) => {
    const node = flow.addNode(config);

    return node;
  };

  return {
    // 单独的 hooks
    entity,
    flow,

    // 组合方法
    addFlowNodeAndRender,

    // 统一清理
    cleanup: () => {
      entity.cleanup();
      flow.clear();
    },

    // 统一状态
    loading: entity.loading || flow.loading,
    error: entity.error || flow.error,
  };
}
