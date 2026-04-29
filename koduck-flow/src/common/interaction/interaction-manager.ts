import type {
  Tool,
  InteractionEnv,
  PointerLikeEvent,
  CanvasProvider,
  ViewportProvider,
} from "./types";

/**
 * Lightweight interaction manager: supports registering/unregistering multiple tools and dispatches events in registration order.
 * The first tool that returns true can prevent subsequent tools from handling the event (can be used as an interception mechanism).
 */
export class InteractionManager implements InteractionEnv {
  private tools: Tool[] = [];
  private readonly canvasProvider: CanvasProvider;
  private readonly viewportProvider: ViewportProvider;

  constructor(
    canvasProvider: CanvasProvider,
    viewportProvider: ViewportProvider
  ) {
    this.canvasProvider = canvasProvider;
    this.viewportProvider = viewportProvider;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvasProvider.getCanvas();
  }

  getViewport() {
    return this.viewportProvider.getViewport();
  }

  register(tool: Tool) {
    this.tools.push(tool);
  }

  unregister(name: string) {
    const idx = this.tools.findIndex((t) => t.name === name);
    if (idx >= 0) {
      this.tools[idx].dispose?.();
      this.tools.splice(idx, 1);
    }
  }

  clear() {
    for (const t of this.tools) t.dispose?.();
    this.tools = [];
  }

  // Event dispatch: if a tool returns true, it means the event is handled and bubbling to other tools is prevented
  onMouseDown(e: PointerLikeEvent) {
    for (const t of this.tools) if (t.onMouseDown?.(e, this)) return true;
    return false;
  }
  onMouseMove(e: PointerLikeEvent) {
    for (const t of this.tools) if (t.onMouseMove?.(e, this)) return true;
    return false;
  }
  onMouseUp(e: PointerLikeEvent) {
    for (const t of this.tools) if (t.onMouseUp?.(e, this)) return true;
    return false;
  }
  onMouseLeave(e: PointerLikeEvent) {
    for (const t of this.tools) if (t.onMouseLeave?.(e, this)) return true;
    return false;
  }
}
