import type { IFlowAST, INode, NodeTraversalFn } from "./types";
import { BaseNode } from "./base-node";
import { meter, ScopedMeter } from "../metrics";

/**
 * Default implementation of FlowAST
 * Based on the IFlowAST interface, implements AST management for tree structures.
 */
export class FlowAST<T extends INode = BaseNode> implements IFlowAST<T> {
  private readonly m = new ScopedMeter(meter("flow"), { component: "FlowAST" });
  /**
   * Root node
   */
  root: T | undefined;

  enableHooks: boolean | undefined;
  hookDepthLimit: number | undefined;

  constructor() {}

  /**
   * Write lock status indicator
   * @private
   */
  private _writeLocked = false;

  /**
   * Execute operations requiring write lock
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
   * Add child node to target node
   */
  addChild(targetNode: T, addedNode: T, index?: number): T {
    return this.withWriteLock(() => {
      // If no root node, set addedNode as root
      if (!this.root) {
        this.root = addedNode;
        this.m.counter("root.set").add(1);
        return addedNode;
      }

      // If addedNode has a parent, remove it first
      if (addedNode.parent) {
        addedNode.parent.removeChild(addedNode);
      }

      // Calculate insertion position
      const idx = index !== undefined ? index : targetNode.getChildCount();

      // Use node's insertChildAt or setChild
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
   * Remove specified node from flow tree
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
   * Depth-first traversal of flow tree
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
   * Move single node under new parent
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
   * Batch move multiple nodes under new parent
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
   * Find node matching condition
   */
  findNode(predicate: (node: T) => boolean, startNode?: T): T | undefined {
    let found: T | undefined;

    this.traverse((node) => {
      if (predicate(node)) {
        found = node;
        return false; // Stop traversal
      }
    }, startNode);

    return found;
  }

  /**
   * Get path from root to specified node
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
   * Serialize entire flow tree to JSON
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
