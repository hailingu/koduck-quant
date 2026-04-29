import { nanoid } from "nanoid";
import type { INode, ISerializable } from "./types";

/**
 * @module src/common/flow/base-node
 * @description Base node implementation for tree/graph structures in flow.
 * Implements parent-child relationships, sibling links, and hierarchy operations
 */

/**
 * Base node for hierarchical tree/graph structures
 * @class
 * @implements {INode<BaseNode>}
 * @implements {ISerializable}
 * @description Provides fundamental node operations including parent-child management,
 * sibling linking, and tree traversal. Automatically generates unique IDs and prevents
 * circular references through cycle detection
 */
export class BaseNode implements INode<BaseNode>, ISerializable {
  /**
   * Unique identifier for this node
   * @type {string}
   * @readonly
   */
  public readonly id: string;

  protected _parent: BaseNode | undefined;
  protected _next: BaseNode | undefined;
  protected _pre: BaseNode | undefined;
  protected _children: BaseNode[] | undefined;

  /**
   * Create a new BaseNode with auto-generated unique ID
   */
  constructor() {
    this.id = nanoid();
  }

  /**
   * Get the parent node
   * @returns {BaseNode | undefined} Parent node reference or undefined if root
   */
  get parent(): BaseNode | undefined {
    return this._parent;
  }

  /**
   * Get the next sibling node
   * @returns {BaseNode | undefined} Next sibling or undefined if last
   */
  get next(): BaseNode | undefined {
    return this._next;
  }

  /**
   * Get the previous sibling node
   * @returns {BaseNode | undefined} Previous sibling or undefined if first
   */
  get pre(): BaseNode | undefined {
    return this._pre;
  }

  /**
   * Get all child nodes as read-only array
   * @returns {BaseNode[]} Array of child nodes, empty array if no children
   */
  get children(): readonly BaseNode[] {
    return this._children || [];
  }

  /**
   * Get the number of direct children
   * @returns {number} Child count, 0 if leaf node
   */
  getChildCount(): number {
    return this._children?.length || 0;
  }

  /**
   * Get the depth level in the tree hierarchy
   * @returns {number} Depth where root = 0, each level increments by 1
   * @example
   * root.getDepth() === 0
   * root.children[0].getDepth() === 1
   */
  getDepth(): number {
    if (!this._parent) return 0;
    return 1 + this._parent.getDepth();
  }

  /**
   * Check if this node is a root (has no parent)
   * @returns {boolean} True if this is a root node, false otherwise
   */
  isRoot(): boolean {
    return !this._parent;
  }

  /**
   * Check if this node is a leaf (has no children)
   * @returns {boolean} True if this is a leaf node, false if has children
   */
  isLeaf(): boolean {
    return !this._children || this._children.length === 0;
  }

  /**
   * Add a child node at the end of the children list
   * @param {BaseNode} child - Node to add as child
   * @returns {number} Index position of the newly added child
   * @throws {Error} If adding child would create a circular reference
   */
  addChild(child: BaseNode): number {
    this.insertChildAt(child, this.getChildCount());
    return this.getChildCount() - 1;
  }

  /**
   * Remove a specific child node
   * @param {BaseNode} child - Child node to remove
   * @returns {boolean} True if child was found and removed, false otherwise
   */
  removeChild(child: BaseNode): boolean {
    if (!this._children) return false;

    const index = this._children.indexOf(child);
    if (index === -1) return false;

    return this.removeChildAt(index) !== undefined;
  }

  /**
   * Set a child node at a specific index position
   * @param {BaseNode} child - Child node to set
   * @param {number} index - Position index for the child (0-based)
   * @throws {Error} If index out of bounds or would create cycle
   * @example
   * parent.setChild(newChild, 0); // Set as first child
   */
  setChild(child: BaseNode, index: number): void {
    this._children ??= [];

    if (index < 0 || index > this._children.length) {
      throw new Error("Index out of bounds");
    }

    if (this.hasAncestor(child)) {
      throw new Error("Setting this child would create a cycle");
    }

    if (index === this._children.length) {
      this.addChild(child);
      return;
    }

    if (child._parent) {
      child.child.remove();
    }

    const oldChild = this._children[index];
    if (oldChild) {
      oldChild._parent = undefined;
    }

    child._parent = this;
    this._children[index] = child;

    this.updateSiblingLinks();
  }

  /**
   * Remove a child node at a specific index
   * @param {number} index - Position index of child to remove (0-based)
   * @returns {BaseNode | undefined} The removed child node or undefined if not found
   */
  removeChildAt(index: number): BaseNode | undefined {
    if (!this._children || index < 0 || index >= this._children.length) {
      return undefined;
    }

    const removedChild = this._children.splice(index, 1)[0];
    removedChild._parent = undefined;
    removedChild._pre = undefined;
    removedChild._next = undefined;

    this.updateSiblingLinks();

    return removedChild;
  }

  /**
   * Insert a child node at a specific index position
   * @param {BaseNode} child - Child node to insert
   * @param {number} index - Position index for insertion (0-based)
   * @throws {Error} If index out of bounds or would create cycle
   * @example
   * parent.insertChildAt(newChild, 1); // Insert as second child
   */
  insertChildAt(child: BaseNode, index: number): void {
    this._children ??= [];

    if (index < 0 || index > this._children.length) {
      throw new Error("Index out of bounds");
    }

    if (this.hasAncestor(child)) {
      throw new Error("Adding this child would create a cycle");
    }

    if (child._parent) {
      child.child.remove();
    }

    child._parent = this;
    this._children.splice(index, 0, child);

    this.updateSiblingLinks();
  }

  /**
   * Check if a node is an ancestor of this node
   * @private
   * @param {BaseNode} ancestor - Node to check
   * @returns {boolean} True if ancestor is in the parent chain
   */
  private hasAncestor(ancestor: BaseNode): boolean {
    if (!this._parent) return false;
    if (this._parent === ancestor) return true;
    return this._parent.hasAncestor(ancestor);
  }

  /**
   * Update sibling links (_pre and _next) for all children
   * @private
   * Maintains doubly-linked list structure among siblings
   */
  private updateSiblingLinks(): void {
    if (!this._children) return;

    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      child._pre = i > 0 ? this._children[i - 1] : undefined;
      child._next = i < this._children.length - 1 ? this._children[i + 1] : undefined;
    }
  }

  /**
   * Dispose of all resources and clean up node relationships
   * Removes this node from parent, disposes all children recursively,
   * and clears all sibling and parent references
   * @example
   * node.dispose(); // Called during cleanup or when removing from tree
   */
  dispose(): void {
    // Clean up parent-child relationship
    if (this._parent) {
      this.this.remove();
    }

    // Dispose all child nodes recursively
    if (this._children) {
      for (const child of [...this._children]) {
        child.dispose();
      }
    }

    // Clean up sibling relationships
    if (this._pre) {
      this._pre._next = this._next;
    }
    if (this._next) {
      this._next._pre = this._pre;
    }

    // Clear all references
    this._parent = undefined;
    this._next = undefined;
    this._pre = undefined;
    this._children = undefined;
  }

  /**
   * Serialize node to JSON representation
   * @returns {Record<string, unknown>} JSON object with id, parent, next, pre, and children IDs
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      parent: this._parent ? this._parent.id : undefined,
      next: this._next ? this._next.id : undefined,
      pre: this._pre ? this._pre.id : undefined,
      children: this._children ? this._children.map((child) => child.id) : [],
    };
  }
}
