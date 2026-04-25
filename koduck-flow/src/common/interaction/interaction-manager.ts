import type {
  Tool,
  InteractionEnv,
  PointerLikeEvent,
  CanvasProvider,
  ViewportProvider,
} from "./types";

/**
 * 轻量交互管理器：支持注册/注销多个工具，并按注册顺序分发事件。
 * 第一个返回 true 的工具可阻止后续工具处理该事件（可作为拦截机制）。
 */
export class InteractionManager implements InteractionEnv {
  private tools: Tool[] = [];
  private canvasProvider: CanvasProvider;
  private viewportProvider: ViewportProvider;

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

  // 事件分发：如果某个 tool 返回 true，表示已处理且阻止冒泡到其他工具
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
