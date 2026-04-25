import type { IRender, IReactRenderer, ISSRRenderer } from "../types";
import { WebGPURender } from "../webgpu-render";

export const isReactRenderer = (renderer: IRender | undefined): renderer is IReactRenderer =>
  Boolean(renderer && renderer.getType?.() === "react");

export const isSSRRenderer = (renderer: IRender | undefined): renderer is ISSRRenderer =>
  Boolean(renderer && renderer.getType?.() === "ssr");

export const isWebGPURenderer = (renderer: IRender | undefined): renderer is WebGPURender => {
  if (!renderer) {
    return false;
  }
  if (renderer instanceof WebGPURender) {
    return true;
  }
  const name = renderer.getName?.();
  if (typeof name === "string") {
    return name.toLowerCase().includes("webgpu");
  }
  return false;
};

export function resolveRendererByPredicate<T extends IRender>(
  renderers: Map<string, IRender>,
  preferredId: string | undefined,
  predicate: (renderer: IRender | undefined) => renderer is T
): T | undefined {
  if (preferredId) {
    const preferred = renderers.get(preferredId);
    if (predicate(preferred)) {
      return preferred;
    }
  }

  for (const renderer of renderers.values()) {
    if (predicate(renderer)) {
      return renderer;
    }
  }

  return undefined;
}
