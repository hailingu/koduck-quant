/**
 * @module flow/types
 * @description Type definitions and interfaces for Koduck Flow module.
 *
 * This module provides the complete type system for flow graph topology, node structures,
 * edge definitions, and entity management. It serves as the foundation for all flow-related
 * type safety and contracts.
 *
 * ## Key Type Categories
 * - **Node Types**: INodeBase, INode, node trees, traversal functions
 * - **Graph Types**: IFlowGraphAST, FlowGraphNode, FlowGraphLink, DAG structures
 * - **Edge Types**: IEdge, IEndpoint, edge management
 * - **AST Types**: IFlowAST, abstract syntax trees, tree operations
 * - **Entity Types**: IFlowEntity, IFlowNodeEntity, IFlowEdgeEntity, flow entities
 * - **Flow Types**: IFlow, complete flow interface with all operations
 * - **Utility Types**: OptionalProp, serialization, lifecycle handlers
 *
 * ## Architecture Features
 * - **Generic Type System**: Full support for type-safe polymorphism
 * - **Interface Contracts**: Clear method signatures with well-defined behavior
 * - **Serialization Support**: All types support JSON serialization
 * - **Lifecycle Hooks**: Built-in support for event hooks and lifecycle management
 * - **Concurrency Control**: Write-locking mechanisms for thread safety
 *
 * ## Usage Pattern
 * ```typescript
 * // Import types for type-safe flow operations
 * import type {
 *   IFlow,
 *   INode,
 *   IFlowGraphAST,
 *   FlowGraphNode,
 *   FlowGraphLink,
 * } from './types';
 *
 * // Use in class/function signatures
 * class FlowManager implements IFlow {
 *   // Implementation here
 * }
 * ```
 *
 * @see {@link IFlow} for complete flow interface
 * @see {@link INode} for node interface
 * @see {@link IFlowGraphAST} for DAG interface
 * @see {@link IEdge} for edge interface
 */

import type { IDisposable } from "../disposable";
import type { IEntity } from "../entity";

/**
 * Optional property helper type
 *
 * Represents a property that can be either the specified type T or undefined.
 * Used throughout the codebase to indicate optional values in type definitions.
 *
 * @template T - The underlying type
 *
 * @example
 * ```typescript
 * type OptionalString = OptionalProp<string>; // string | undefined
 * ```
 */
export type OptionalProp<T> = T | undefined;

/**
 * Serializable interface
 *
 * Defines the contract for types that can be serialized to JSON format.
 * Any type implementing this interface must provide a toJSON() method
 * for JSON.stringify compatibility.
 *
 * @example
 * ```typescript
 * class MyClass implements ISerializable {
 *   toJSON(): Record<string, unknown> {
 *     return { field: this.field };
 *   }
 * }
 *
 * const json = JSON.stringify(new MyClass());
 * ```
 */
export interface ISerializable {
  /**
   * Serialize to JSON-compatible object
   *
   * @returns JSON-compatible representation of the object
   */
  toJSON(): Record<string, unknown>;
}

/**
 * Base node interface
 *
 * Defines the minimum contract for flow graph nodes. Provides tree structure operations
 * with parent-child relationships, sibling links, and hierarchical queries.
 *
 * ## Design
 * - **Self-Referencing**: INode extends INodeBase with narrower type bounds for generic consistency
 * - **Tree Structure**: Supports arbitrary parent-child relationships and sibling links
 * - **Immutability**: Relationship accessors are read-only; modifications through methods
 * - **Traversal**: DFS/BFS support through visitor callbacks
 *
 * ## Key Properties
 * - `id`: Unique identifier per node
 * - `parent`: Parent node reference (undefined if root)
 * - `next`/`pre`: Sibling pointers for linked list behavior
 * - `children`: All child nodes (immutable array)
 *
 * @see {@link INode} for generic type-safe version
 * @see {@link NodeTraversalFn} for traversal callbacks
 */
export interface INodeBase extends IDisposable, ISerializable {
  /**
   * Unique node identifier
   *
   * Should be unique within the tree context.
   * Used for lookups, references, and serialization.
   */
  readonly id: string;

  /**
   * Parent node reference
   *
   * Undefined if this is the root node. Part of parent-child relationship tracking.
   *
   * @see {@link addChild} to modify parent
   */
  readonly parent: OptionalProp<INodeBase>;

  /**
   * Next sibling in linked list
   *
   * Part of sibling linked-list structure for efficient iteration.
   * Undefined if this is the last child.
   */
  readonly next: OptionalProp<INodeBase>;

  /**
   * Previous sibling in linked list
   *
   * Part of sibling linked-list structure. Undefined if this is the first child.
   */
  readonly pre: OptionalProp<INodeBase>;

  /**
   * Child nodes (read-only)
   *
   * Immutable reference to all child nodes. Use methods to modify.
   */
  readonly children: readonly INodeBase[];

  /**
   * Get number of direct children
   *
   * @returns Count of direct children (0 for leaf nodes)
   */
  getChildCount(): number;

  /**
   * Get node depth in tree
   *
   * Calculates distance from root (0) to this node.
   * Uses recursive calculation: parent depth + 1.
   *
   * @returns Depth value (0 for root)
   *
   * @example
   * ```typescript
   * root.getDepth(); // 0
   * root.children[0].getDepth(); // 1
   * ```
   */
  getDepth(): number;

  /**
   * Check if this is a root node
   *
   * @returns true if parent is undefined
   */
  isRoot(): boolean;

  /**
   * Check if this is a leaf node
   *
   * @returns true if has no children
   */
  isLeaf(): boolean;

  /**
   * Add child node
   *
   * Appends child to end of children list. Updates sibling pointers.
   *
   * @param child - Node to add as child
   * @returns Index of added child (0-based)
   *
   * @throws Error if child is already assigned another parent
   *
   * @example
   * ```typescript
   * const index = parent.addChild(child);
   * console.log(index); // Position in children array
   * ```
   */
  addChild(child: INodeBase): number;

  /**
   * Remove child node
   *
   * Removes specified child and updates sibling pointers.
   *
   * @param child - Child node to remove
   * @returns true if removed, false if not found
   */
  removeChild(child: INodeBase): boolean;

  /**
   * Set child at specific index
   *
   * Replaces child at given index with new child.
   * Index is 1-based (compatible with legacy API).
   *
   * @param child - New child node
   * @param index - 1-based position index
   */
  setChild(child: INodeBase, index: number): void;

  /**
   * Remove child at index
   *
   * @param index - 0-based or 1-based position (check implementation)
   * @returns Removed node or undefined
   */
  removeChildAt(index: number): INodeBase | undefined;

  /**
   * Insert child at index
   *
   * Inserts child at given position, shifting others.
   *
   * @param child - Child to insert
   * @param index - 1-based insertion position
   */
  insertChildAt(child: INodeBase, index: number): void;
}

/**
 * Generic node interface
 *
 * Type-safe version of INodeBase with generic type parameter N for consistent typing.
 * All methods are typed to return instances of type N instead of INodeBase.
 *
 * @template N - Node type (must extend INodeBase), defaults to INodeBase
 *
 * ## Key Difference from INodeBase
 * All methods work with type N instead of INodeBase, ensuring type consistency
 * through the tree structure.
 *
 * @example
 * ```typescript
 * class MyNode implements INode<MyNode> {
 *   // Implementation specific to MyNode
 * }
 *
 * const node: INode<MyNode> = new MyNode();
 * const child = node.children[0] as MyNode; // Type-safe
 * ```
 *
 * @see {@link INodeBase} for untyped version
 */
export interface INode<N extends INodeBase = INodeBase> extends INodeBase {
  /** Parent node (type-safe) */
  readonly parent: OptionalProp<N>;

  /** Next sibling (type-safe) */
  readonly next: OptionalProp<N>;

  /** Previous sibling (type-safe) */
  readonly pre: OptionalProp<N>;

  /** Children array (type-safe) */
  readonly children: readonly N[];

  /**
   * Add child node (type-safe)
   *
   * @param child - Must be of type N
   * @returns Index of added child
   */
  addChild(child: N): number;

  /** Remove child (type-safe) */
  removeChild(child: N): boolean;

  /** Set child at index (type-safe) */
  setChild(child: N, index: number): void;

  /** Remove child at index (type-safe) */
  removeChildAt(index: number): N | undefined;

  /** Insert child at index (type-safe) */
  insertChildAt(child: N, index: number): void;
}

/**
 * Node traversal callback function
 *
 * Visitor pattern callback for tree/graph traversal.
 * Called for each node visited during traversal.
 *
 * @template N - Node type being traversed
 *
 * @param node - Current node being visited
 * @returns true or undefined to continue traversal, false to stop
 *
 * @example
 * ```typescript
 * const visit: NodeTraversalFn<MyNode> = (node) => {
 *   console.log(node.id);
 *   return true; // continue
 * };
 *
 * ast.traverse(visit);
 * ```
 */
export type NodeTraversalFn<N extends INodeBase = INodeBase> = (node: N) => boolean | void;

/**
 * Link metadata for flow graph connections
 *
 * Extensible metadata object stored on graph links/edges.
 * Allows custom properties while providing standard fields for common uses.
 *
 * ## Standard Fields
 * - `edgeId`: Associated edge identifier (optional)
 * - `label`: Human-readable link label (optional)
 * - `role`: Semantic role of the link (optional)
 * - Custom properties: Any other application-specific data
 *
 * @example
 * ```typescript
 * const metadata: FlowLinkMetadata = {
 *   label: 'on-success',
 *   role: 'success-path',
 *   delay: 1000,
 *   retryCount: 3,
 * };
 * ```
 */
export type FlowLinkMetadata = {
  /** Associated edge ID for cross-referencing */
  edgeId?: OptionalProp<string>;
  /** Human-readable label for the link */
  label?: OptionalProp<string>;
  /** Semantic role identifier */
  role?: OptionalProp<string>;
  /** Allow additional custom properties */
  [key: string]: unknown;
};

/**
 * Graph link structure
 *
 * Represents a directed edge in the flow graph. Links are immutable once created
 * and are identified by unique IDs. Metadata is stored for link-specific information.
 *
 * ## Properties
 * - `id`: Unique link identifier (globally unique with nanoid suffix)
 * - `sourceId`: Source node ID (parent)
 * - `targetId`: Target node ID (child)
 * - `metadata`: Optional link-specific metadata
 *
 * @see {@link FlowGraphLinkInit} for creation data
 * @see {@link FlowLinkMetadata} for metadata structure
 *
 * @example
 * ```typescript
 * const link: FlowGraphLink = {
 *   id: 'link-123::456::abc123',
 *   sourceId: 'parent-1',
 *   targetId: 'child-1',
 *   metadata: { label: 'success' },
 * };
 * ```
 */
export interface FlowGraphLink {
  /** Unique link identifier */
  id: string;
  /** Source node ID (parent/from) */
  sourceId: string;
  /** Target node ID (child/to) */
  targetId: string;
  /** Optional metadata attached to this link */
  metadata?: OptionalProp<FlowLinkMetadata>;
}

/**
 * Link initialization data
 *
 * Used when creating links. Most fields are optional for convenience;
 * only `targetId` is required.
 *
 * @see {@link FlowGraphLink} for the finalized link structure
 */
export type FlowGraphLinkInit = {
  /** Generated if not provided */
  id?: OptionalProp<string>;
  /** Defaults to parent node if not specified */
  sourceId?: OptionalProp<string>;
  /** Required - target node ID */
  targetId: string;
  /** Optional link metadata */
  metadata?: OptionalProp<FlowLinkMetadata>;
};

/**
 * Graph node structure
 *
 * Represents a node in the DAG (directed acyclic graph). Includes references to
 * parent nodes and child links, along with optional entity data.
 *
 * ## Properties
 * - `id`: Unique node identifier
 * - `parents`: Set of parent node IDs
 * - `children`: Map of child link IDs to link objects
 * - `entityType`: Optional type classification
 * - `data`: Optional custom data storage
 *
 * @see {@link FlowGraphNodeInit} for creation
 * @see {@link FlowGraphLink} for child link structure
 */
export interface FlowGraphNode {
  /** Unique node identifier */
  id: string;
  /** Optional entity type classification */
  entityType?: OptionalProp<string>;
  /** Optional custom data attached to node */
  data?: OptionalProp<Record<string, unknown>>;
  /** Set of parent node IDs */
  parents: Set<string>;
  /** Map of child ID → link info for outgoing edges */
  children: Map<string, FlowGraphLink>;
}

/**
 * Node initialization data
 *
 * Data structure for creating new graph nodes with optional parent/child setup.
 * Parents and children can be specified as iterables for convenience.
 *
 * @see {@link FlowGraphNode} for finalized node structure
 *
 * @example
 * ```typescript
 * const nodeInit: FlowGraphNodeInit = {
 *   id: 'node-1',
 *   parents: ['parent-1', 'parent-2'],
 *   children: [
 *     { targetId: 'child-1', metadata: { label: 'then' } },
 *     { targetId: 'child-2', metadata: { label: 'else' } },
 *   ],
 * };
 * ```
 */
export type FlowGraphNodeInit = {
  /** Required - unique node identifier */
  id: string;
  /** Optional entity type for classification */
  entityType?: OptionalProp<string>;
  /** Optional custom data to attach */
  data?: OptionalProp<Record<string, unknown>>;
  /** Optional parent node IDs (iterable for convenience) */
  parents?: OptionalProp<Iterable<string>>;
  /** Optional child link initializations */
  children?: OptionalProp<Iterable<FlowGraphLinkInit>>;
};

/**
 * Graph node snapshot for serialization
 *
 * JSON-serializable representation of a graph node. Used in serialization/deserialization
 * to preserve graph structure across storage or transmission.
 *
 * Note: Sets and Maps are converted to arrays for JSON compatibility.
 *
 * @see {@link FlowASTSnapshot} for complete graph snapshot
 */
export type FlowGraphNodeSnapshot = {
  /** Node unique identifier */
  id: string;
  /** Optional entity type */
  entityType?: OptionalProp<string>;
  /** Optional custom data */
  data?: OptionalProp<Record<string, unknown>>;
  /** Parent node IDs (array format for JSON) */
  parents: string[];
  /** Child link info array */
  children: Array<{
    /** Child node ID */
    childId: string;
    /** Link ID for identification */
    linkId: string;
    /** Optional link metadata */
    metadata?: OptionalProp<FlowLinkMetadata>;
  }>;
};

/**
 * Complete DAG snapshot
 *
 * Represents the complete serialized state of a flow graph (DAG).
 * Can be converted to/from JSON for persistence.
 *
 * @see {@link IFlowGraphAST.toJSON} for serialization
 * @see {@link IFlowGraphAST.fromJSON} for deserialization
 *
 * @example
 * ```typescript
 * // Serialize graph
 * const snapshot: FlowASTSnapshot = graph.toJSON();
 * const json = JSON.stringify(snapshot);
 *
 * // Later, deserialize
 * const restored = FlowGraphAST.fromJSON(JSON.parse(json));
 * ```
 */
export type FlowASTSnapshot = {
  /** All nodes in the graph */
  nodes: FlowGraphNodeSnapshot[];
};

/**
 * Node linking options
 *
 * Options for linking nodes in the graph, supporting both static and dynamic metadata.
 *
 * @see {@link IFlow.addNode} for usage
 */
export type FlowNodeLinkOptions = {
  /** Parent node IDs to link to */
  parentIds: OptionalProp<string[]>;
  /** Link metadata: static object or generator function */
  linkMetadata: OptionalProp<
    FlowLinkMetadata | ((parentId: string, childId: string) => FlowLinkMetadata | undefined)
  >;
};

/**
 *
 */
export interface IFlowGraphAST extends IDisposable, ISerializable {
  addNode(node: FlowGraphNodeInit): FlowGraphNode;
  removeNode(nodeId: string): boolean;
  attachChild(parentId: string, childId: string, metadata?: FlowLinkMetadata): FlowGraphLink;
  detachChild(parentId: string, childId: string): boolean;
  getNode(nodeId: string): FlowGraphNode | undefined;
  getParents(nodeId: string): string[];
  getChildren(nodeId: string): FlowGraphLink[];
  getRoots(): string[];
  hasNode(nodeId: string): boolean;
  traverse(
    visitor: (node: FlowGraphNode) => boolean | void,
    options?: { strategy?: "dfs" | "bfs"; allowRepeat?: boolean }
  ): void;
}

/**
 * 边端点实体接口
 */
export interface IEndpoint extends IDisposable, ISerializable {
  nodeId: string;
  port: "in" | "out" | string;
  state: "active" | "inactive" | "disabled";
  portIndex?: number;
}

/**
 * 边接口
 * 定义了边的公共 API，支持节点间的连接管理，支持多个源和目标端点。
 */
export interface IEdge extends IDisposable, ISerializable {
  // 端点和节点
  readonly sources: IEndpoint[];
  readonly targets: IEndpoint[];

  // 状态
  readonly isValid: boolean;
  readonly state: "active" | "inactive" | "disabled";

  // 状态管理
  setState(state: "active" | "inactive" | "disabled"): void;
  activate(): void;
  deactivate(): void;
  disable(): void;
  isActive(): boolean;

  // 连接检查
  connectsNode(nodeId: string): boolean;
  connectsNodes(node1: string, node2: string): boolean;
  getOtherNodes(nodeId: string): string[];
  isSelfLoop(): boolean;
}

/**
 *
 */
export interface IFlowAST<N extends INode = INode> extends IDisposable, ISerializable {
  /**
   * 根节点
   * 流程图的起始节点，整个流程树的入口点
   */
  root: OptionalProp<N>;

  /**
   * 写锁状态标识
   * 用于实现非重入的写锁机制，防止并发修改结构。
   */
  readonly isLocked: boolean;

  /**
   * 钩子配置
   */
  enableHooks: OptionalProp<boolean>;
  hookDepthLimit: OptionalProp<number>;

  /**
   * 添加子节点到目标节点
   * @param targetNode 目标父节点
   * @param addedNode 要添加的子节点
   * @param index 可选的插入位置索引（1基）
   * @returns 返回添加的节点实例
   */
  addChild(targetNode: N, addedNode: N, index?: number): N;

  /**
   * 从流程树中移除指定节点
   * @param node 要移除的节点
   * @returns 操作是否成功
   */
  removeNode(node: N): boolean;

  /**
   * 深度优先遍历流程树
   * @param f 节点访问回调，返回 false 将终止遍历
   * @param node 起始节点，默认从 root 开始
   * @param depth 起始深度，默认 0
   */
  traverse(f: NodeTraversalFn<N>, node: N, depth: number): void;
  traverse(f: NodeTraversalFn<N>, node?: N, depth?: number): void;

  /**
   * 移动单个节点到新的父节点下
   * @param node 要移动的节点
   * @param newParent 新的父节点
   * @param index 插入位置（可选），使用1基索引
   * @returns 操作是否成功
   */
  moveNode(node: N, newParent: N, index?: number): boolean;

  /**
   * 批量移动多个节点到新的父节点下
   * @param nodes 要移动的节点数组
   * @param newParent 新的父节点
   * @param startIndex 起始插入位置（可选），使用1基索引
   * @returns 操作是否成功
   */
  moveNodes(nodes: N[], newParent: N, startIndex?: number): boolean;

  /**
   * 查找满足条件的节点
   * @param predicate 查找条件函数
   * @param startNode 起始节点，默认从 root 开始
   * @returns 找到的节点或 undefined
   */
  findNode(predicate: (node: N) => boolean, startNode?: N): N | undefined;

  /**
   * 获取从根到指定节点的路径
   * @param node 目标节点
   * @returns 路径数组，从根到节点
   */
  getPath(node: N): N[];
}

/**
 * Flow 实体接口
 * 定义了 Flow 实体管理的接口，支持实体的创建、更新、删除和序列化。
 */
export type FlowHookResult = boolean | void | Promise<boolean | void>;

/**
 *
 */
export type IFlowEntity<TEntity extends IEntity = IEntity> = TEntity & ISerializable;

/**
 *
 */
export type IFlowNodeEntity<
  N extends INodeBase = INodeBase,
  TEntity extends IEntity = IEntity,
> = IFlowEntity<TEntity> & {
  readonly node: N;
};

/**
 *
 */
export type IFlowEdgeEntity<
  E extends IEdge = IEdge,
  TEntity extends IEntity = IEntity,
> = IFlowEntity<TEntity> & {
  readonly edge: E;
};

/**
 *
 */
export type FlowLifecycleHandler<T> = (payload: T) => FlowHookResult;

/**
 *
 */
export interface FlowMetadata {
  version?: string | number;
  status?: string;
  [key: string]: unknown;
}

/**
 * Flow 接口
 * 定义了流程的公共 API，参考 Flow 类的实现，支持实体管理和流程树操作。
 *
 * 设计要点：
 * - 泛型 N 扩展 INode<N>，确保节点类型一致性。
 * - 提供实体管理功能，可以直接操作 IFlowEntity 实例。
 * - 支持流程树的遍历、节点操作和序列化。
 */
export interface IFlow<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> extends IDisposable,
    ISerializable {
  /**
   * 流程抽象语法树
   * 可选的 AST，用于管理流程树结构。
   * 类型对齐要求：T 必须等于 N。
   */
  flowAST: OptionalProp<IFlowAST<N>>;
  flowGraph: OptionalProp<IFlowGraphAST>;

  /**
   * 序列化相关属性
   */
  id: string;
  name: OptionalProp<string>;
  createdAt: string;
  updatedAt: OptionalProp<string>;
  metadata: OptionalProp<FlowMetadata>;

  /**
   * 钩子配置
   */
  enableHooks: OptionalProp<boolean>;
  hookDepthLimit: OptionalProp<number>;

  /**
   * 事件钩子
   * 返回 false 中断操作，异步钩子应避免阻塞。
   */
  onEntityAdded: OptionalProp<FlowLifecycleHandler<NE>>;
  onEntityRemoved: OptionalProp<FlowLifecycleHandler<string>>;
  onFlowLoaded: OptionalProp<FlowLifecycleHandler<Record<string, unknown>>>;
  onFlowSaved: OptionalProp<FlowLifecycleHandler<void>>;

  /**
   * 遍历流程树
   * @param f 节点访问回调
   * @param node 起始节点
   * @param depth 起始深度
   */
  traverse(f: NodeTraversalFn<N>, node: N, depth: number): void;
  traverse(f: NodeTraversalFn<N>, node?: N, depth?: number): void;

  /**
   * 添加子节点到目标节点
   * @param targetNode 目标父节点
   * @param childNode 子节点
   * @returns 操作是否成功
   */
  addToNode(targetNode: N, childNode: N): boolean;

  /**
   * 为节点绑定实体实例，通常在 AST 与实体系统同步时使用。
   */
  attachEntityToNode?(node: N, entity: NE): void;

  /**
   * 移除节点
   * @param id 节点 ID
   * @returns 操作是否成功
   */
  removeNode(id: string): boolean;

  /**
   * 获取节点
   * @param id 节点 ID
   * @returns 节点实例或 undefined
   */
  getNode(id: string): N | undefined;

  /**
   * 获取所有节点
   * @returns 节点数组
   */
  getAllNodes(): N[];

  /**
   * 检查是否包含节点
   * @param node 节点实例
   * @returns 是否包含
   */
  hasNode(node: N): boolean;

  /**
   * 创建实体
   * @param type 实体类型
   * @param args 创建参数
   * @returns 创建的实体实例
   */
  createEntity<T extends NE = NE>(type: string, args?: Record<string, unknown>): T;

  /**
   * 获取实体
   * @param id 实体 ID
   * @returns 实体实例或 undefined
   */
  getEntity<T extends IFlowEntity>(id: string): T | undefined;

  /**
   * 获取根实体
   * @returns 根实体的 IFlowEntity 实例或 undefined
   */
  getRootEntity(): NE | undefined;

  /**
   * 获取实体的子实体
   * @param entity 父实体
   * @returns 子实体的数组
   */
  getChildEntities(entity: NE): NE[];

  /**
   * 获取所有实体
   */
  getAllEntities(): NE[];

  /**
   * 获取所有边实体
   */
  getAllEdgeEntities?(): EE[];

  /**
   * 记录节点到图结构中，并可选地与给定父节点建立链接。
   */
  addNode(entity: NE, options?: FlowNodeLinkOptions): void;

  /**
   * 新增边实体
   */
  addEdgeEntity?(edge: EE): boolean;

  /**
   * 在图上直接建立节点间链接。
   */
  linkNodes(sourceId: string, targetId: string, metadata?: FlowLinkMetadata): boolean;

  /**
   * 移除节点之间的链接。
   */
  unlinkNodes(sourceId: string, targetId: string): boolean;

  /**
   * 移除边实体
   */
  removeEdgeEntity?(edgeId: string): boolean;

  /**
   * 获取指定边实体
   */
  getEdgeEntity?(edgeId: string): EE | undefined;

  /**
   * 创建并注册新的边实体
   */
  createEdgeEntity?(type: string, args?: Record<string, unknown>): EE;

  /**
   * 通过节点查找实体（使用内部索引，必要时回退线性扫描）
   */
  findEntityByNode(node: N): NE | undefined;
}
