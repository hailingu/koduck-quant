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
 * Edge endpoint entity interface
 */
export interface IEndpoint extends IDisposable, ISerializable {
  nodeId: string;
  port: "in" | "out" | string;
  state: "active" | "inactive" | "disabled";
  portIndex?: number;
}

/**
 * Edge interface
 * Defines the public API for edges, supporting connection management between nodes with multiple source and target endpoints.
 */
export interface IEdge extends IDisposable, ISerializable {
  // Endpoints and nodes
  readonly sources: IEndpoint[];
  readonly targets: IEndpoint[];

  // State
  readonly isValid: boolean;
  readonly state: "active" | "inactive" | "disabled";

  // State management
  setState(state: "active" | "inactive" | "disabled"): void;
  activate(): void;
  deactivate(): void;
  disable(): void;
  isActive(): boolean;

  // Connection checks
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
   * Root node
   * The starting node of the flowchart, the entry point of the entire flow tree
   */
  root: OptionalProp<N>;

  /**
   * Write-lock state flag
   * Used to implement a non-reentrant write-lock mechanism to prevent concurrent structural modifications.
   */
  readonly isLocked: boolean;

  /**
   * Hook configuration
   */
  enableHooks: OptionalProp<boolean>;
  hookDepthLimit: OptionalProp<number>;

  /**
   * Add a child node to the target node
   * @param targetNode Target parent node
   * @param addedNode Child node to add
   * @param index Optional insertion position index (1-based)
   * @returns The added node instance
   */
  addChild(targetNode: N, addedNode: N, index?: number): N;

  /**
   * Remove the specified node from the flow tree
   * @param node Node to remove
   * @returns Whether the operation succeeded
   */
  removeNode(node: N): boolean;

  /**
   * Depth-first traversal of the flow tree
   * @param f Node visitor callback; returning false stops traversal
   * @param node Starting node, defaults to root
   * @param depth Starting depth, defaults to 0
   */
  traverse(f: NodeTraversalFn<N>, node: N, depth: number): void;
  traverse(f: NodeTraversalFn<N>, node?: N, depth?: number): void;

  /**
   * Move a single node under a new parent
   * @param node Node to move
   * @param newParent New parent node
   * @param index Insertion position (optional), using 1-based index
   * @returns Whether the operation succeeded
   */
  moveNode(node: N, newParent: N, index?: number): boolean;

  /**
   * Batch move multiple nodes under a new parent
   * @param nodes Array of nodes to move
   * @param newParent New parent node
   * @param startIndex Starting insertion position (optional), using 1-based index
   * @returns Whether the operation succeeded
   */
  moveNodes(nodes: N[], newParent: N, startIndex?: number): boolean;

  /**
   * Find a node matching the condition
   * @param predicate Search condition function
   * @param startNode Starting node, defaults to root
   * @returns The found node or undefined
   */
  findNode(predicate: (node: N) => boolean, startNode?: N): N | undefined;

  /**
   * Get the path from root to the specified node
   * @param node Target node
   * @returns Path array from root to node
   */
  getPath(node: N): N[];
}

/**
 * Flow entity interface
 * Defines the interface for Flow entity management, supporting entity creation, update, deletion, and serialization.
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
 * Flow interface
 * Defines the public API for flows, referencing the Flow class implementation, supporting entity management and flow tree operations.
 *
 * Design highlights:
 * - Generic N extends INode<N> to ensure node type consistency.
 * - Provides entity management capabilities, allowing direct manipulation of IFlowEntity instances.
 * - Supports flow tree traversal, node operations, and serialization.
 */
export interface IFlow<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> extends IDisposable,
    ISerializable {
  /**
   * Flow abstract syntax tree
   * Optional AST for managing the flow tree structure.
   * Type alignment requirement: T must equal N.
   */
  flowAST: OptionalProp<IFlowAST<N>>;
  flowGraph: OptionalProp<IFlowGraphAST>;

  /**
   * Serialization-related properties
   */
  id: string;
  name: OptionalProp<string>;
  createdAt: string;
  updatedAt: OptionalProp<string>;
  metadata: OptionalProp<FlowMetadata>;

  /**
   * Hook configuration
   */
  enableHooks: OptionalProp<boolean>;
  hookDepthLimit: OptionalProp<number>;

  /**
   * Event hooks
   * Returning false interrupts the operation; async hooks should avoid blocking.
   */
  onEntityAdded: OptionalProp<FlowLifecycleHandler<NE>>;
  onEntityRemoved: OptionalProp<FlowLifecycleHandler<string>>;
  onFlowLoaded: OptionalProp<FlowLifecycleHandler<Record<string, unknown>>>;
  onFlowSaved: OptionalProp<FlowLifecycleHandler<void>>;

  /**
   * Traverse the flow tree
   * @param f Node visitor callback
   * @param node Starting node
   * @param depth Starting depth
   */
  traverse(f: NodeTraversalFn<N>, node: N, depth: number): void;
  traverse(f: NodeTraversalFn<N>, node?: N, depth?: number): void;

  /**
   * Add a child node to the target node
   * @param targetNode Target parent node
   * @param childNode Child node
   * @returns Whether the operation succeeded
   */
  addToNode(targetNode: N, childNode: N): boolean;

  /**
   * Bind an entity instance to a node, typically used when synchronizing the AST with the entity system.
   */
  attachEntityToNode?(node: N, entity: NE): void;

  /**
   * Remove a node
   * @param id Node ID
   * @returns Whether the operation succeeded
   */
  removeNode(id: string): boolean;

  /**
   * Get a node
   * @param id Node ID
   * @returns Node instance or undefined
   */
  getNode(id: string): N | undefined;

  /**
   * Get all nodes
   * @returns Array of nodes
   */
  getAllNodes(): N[];

  /**
   * Check if a node is contained
   * @param node Node instance
   * @returns Whether it is contained
   */
  hasNode(node: N): boolean;

  /**
   * Create an entity
   * @param type Entity type
   * @param args Creation arguments
   * @returns Created entity instance
   */
  createEntity<T extends NE = NE>(type: string, args?: Record<string, unknown>): T;

  /**
   * Get an entity
   * @param id Entity ID
   * @returns Entity instance or undefined
   */
  getEntity<T extends IFlowEntity>(id: string): T | undefined;

  /**
   * Get the root entity
   * @returns Root entity IFlowEntity instance or undefined
   */
  getRootEntity(): NE | undefined;

  /**
   * Get child entities of an entity
   * @param entity Parent entity
   * @returns Array of child entities
   */
  getChildEntities(entity: NE): NE[];

  /**
   * Get all entities
   */
  getAllEntities(): NE[];

  /**
   * Get all edge entities
   */
  getAllEdgeEntities?(): EE[];

  /**
   * Record a node into the graph structure, optionally establishing a link with a given parent node.
   */
  addNode(entity: NE, options?: FlowNodeLinkOptions): void;

  /**
   * Add a new edge entity
   */
  addEdgeEntity?(edge: EE): boolean;

  /**
   * Directly establish links between nodes on the graph.
   */
  linkNodes(sourceId: string, targetId: string, metadata?: FlowLinkMetadata): boolean;

  /**
   * Remove links between nodes.
   */
  unlinkNodes(sourceId: string, targetId: string): boolean;

  /**
   * Remove an edge entity
   */
  removeEdgeEntity?(edgeId: string): boolean;

  /**
   * Get the specified edge entity
   */
  getEdgeEntity?(edgeId: string): EE | undefined;

  /**
   * Create and register a new edge entity
   */
  createEdgeEntity?(type: string, args?: Record<string, unknown>): EE;

  /**
   * Find entity by node (uses internal index, falls back to linear scan if necessary)
   */
  findEntityByNode(node: N): NE | undefined;
}
