import type { IFlowAST, INode, NodeTraversalFn } from "./types";
import { BaseNode } from "./base-node";
import { meter, ScopedMeter } from "../metrics";

/**
 * FlowAST 的默认实现
 * 基于 IFlowAST 接口，实现树形结构的 AST 管理。
 */
export class FlowAST<T extends INode = BaseNode> implements IFlowAST<T> {
  private readonly m = new ScopedMeter(meter("flow"), { component: "FlowAST" });
  /**
   * 根节点
   */
  root: T | undefined;

  enableHooks: boolean | undefined;
  hookDepthLimit: number | undefined;

  constructor() {}

  /**
   * 写锁状态标识
   * @private
   */
  private _writeLocked = false;

  /**
   * 执行需要写锁的操作
   * @private
   */
  private withWriteLock<R>(f: () => R): R {
    if (this._writeLocked) {
      this.m.counter("lock.contention").add(1);
      throw new Error("Cannot modify FlowAST: write lock is active");
    }
    this._writeLocked = true;
    try {
      const start = performance.now();
      const r = f();
      const dur = performance.now() - start;
      this.m.histogram("write_op.duration.ms", { unit: "ms" }).record(dur);
      return r;
    } finally {
      this._writeLocked = false;
    }
  }

  get isLocked(): boolean {
    return this._writeLocked;
  }

  /**
   * 添加子节点到目标节点
   */
  addChild(targetNode: T, addedNode: T, index?: number): T {
    return this.withWriteLock(() => {
      // 如果没有根节点，设置 addedNode 为根
      if (!this.root) {
        this.root = addedNode;
        this.m.counter("root.set").add(1);
        return addedNode;
      }

      // 如果 addedNode 有父节点，先移除
      if (addedNode.parent) {
        addedNode.parent.removeChild(addedNode);
      }

      // 计算插入位置
      const idx = index !== undefined ? index : targetNode.getChildCount();

      // 使用节点的 insertChildAt 或 setChild
      if (idx >= targetNode.getChildCount()) {
        targetNode.addChild(addedNode);
      } else {
        targetNode.insertChildAt(addedNode, idx);
      }

      this.m.counter("node.added").add(1);
      return addedNode;
    });
  }

  /**
   * 从流程树中移除指定节点
   */
  removeNode(node: T): boolean {
    return this.withWriteLock(() => {
      if (!node) return false;

      if (this.root === node) {
        this.root = undefined;
        this.m.counter("root.cleared").add(1);
        return true;
      }

      if (node.parent) {
        const ok = node.parent.removeChild(node);
        if (ok) this.m.counter("node.removed").add(1);
        return ok;
      }

      return false;
    });
  }

  /**
   * 深度优先遍历流程树
   */
  traverse(f: NodeTraversalFn<T>, node?: T, depth = 0): void {
    const startNode = node ?? (this.root);
    if (!startNode) return;

    const visited = new Set<T>();

    const walk = (n: T, d: number): boolean => {
      if (visited.has(n)) return true;
      visited.add(n);

      const cont = f(n);
      if (cont === false) return false;

      for (const child of n.children as readonly T[]) {
        if (walk(child, d + 1) === false) return false;
      }

      return true;
    };
    const start = performance.now();
    walk(startNode, depth);
    const dur = performance.now() - start;
    this.m.counter("traverse.count").add(1);
    this.m.histogram("traverse.duration.ms", { unit: "ms" }).record(dur);
  }

  /**
   * 移动单个节点到新的父节点下
   */
  moveNode(node: T, newParent: T, index?: number): boolean {
    if (!node || !newParent) return false;
    if (node === newParent) return false;

    this.withWriteLock(() => {
      if (node.parent) {
        node.parent.removeChild(node);
      }

      if (index !== undefined) {
        newParent.insertChildAt(node, index);
      } else {
        newParent.addChild(node);
      }
    });
    this.m.counter("node.moved").add(1);
    return true;
  }

  /**
   * 批量移动多个节点到新的父节点下
   */
  moveNodes(nodes: T[], newParent: T, startIndex?: number): boolean {
    if (!nodes || !newParent) return false;

    const start = performance.now();
    this.withWriteLock(() => {
      let idx = startIndex !== undefined ? startIndex : newParent.getChildCount();

      for (const node of nodes) {
        if (node.parent) {
          node.parent.removeChild(node);
        }

        if (idx >= newParent.getChildCount()) {
          newParent.addChild(node);
        } else {
          newParent.insertChildAt(node, idx);
        }
        idx++;
      }
    });
    const dur = performance.now() - start;
    this.m.counter("nodes.moved").add(nodes.length);
    this.m.histogram("nodes.move.duration.ms", { unit: "ms" }).record(dur, { count: nodes.length });
    return true;
  }

  /**
   * 查找满足条件的节点
   */
  findNode(predicate: (node: T) => boolean, startNode?: T): T | undefined {
    let found: T | undefined;

    this.traverse((node) => {
      if (predicate(node)) {
        found = node;
        return false; // 停止遍历
      }
    }, startNode);

    return found;
  }

  /**
   * 获取从根到指定节点的路径
   */
  getPath(node: T): T[] {
    // Check if node is in the tree by traversing up to root
    let current: T | undefined = node;
    let isInTree = false;
    while (current) {
      if (current === this.root) {
        isInTree = true;
        break;
      }
      current = current.parent as T | undefined;
    }

    if (!isInTree) {
      return [];
    }

    const path: T[] = [];
    current = node;

    while (current) {
      path.unshift(current);
      current = current.parent as T | undefined;
    }

    return path;
  }

  /**
   * 序列化整个流程树为 JSON
   */
  toJSON(options?: { maxDepth?: number; visited?: Set<unknown> }): Record<string, unknown> {
    const maxDepth = options?.maxDepth ?? 10;
    const visited = options?.visited ?? new Set<unknown>();

    const serializeNode = (node: T, depth: number): Record<string, unknown> => {
      if (depth > maxDepth || visited.has(node)) {
        return { type: "truncated", depth };
      }
      visited.add(node);
      return {
        ...node.toJSON(),
        children: (node.children as readonly T[]).map((child) => serializeNode(child, depth + 1)),
      };
    };

    const start = performance.now();
    const out: Record<string, unknown> = {
      root: this.root ? serializeNode(this.root, 0) : undefined,
    };
    const dur = performance.now() - start;
    this.m.histogram("serialize.duration.ms", { unit: "ms" }).record(dur);
    return out;
  }

  dispose(): void {
    if (this.root && "dispose" in this.root && typeof this.root.dispose === "function") {
      this.root.dispose();
    }
    this.root = undefined;
  }
}
