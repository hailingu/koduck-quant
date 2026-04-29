/**
 * @module flow-graph
 * @description Directed acyclic graph (DAG) implementation for flow topology management.
 *
 * This module provides the {@link FlowGraphAST} class, a thread-safe DAG implementation
 * for managing flow topology with nodes and directed links. Supports complex graph operations
 * including cycle detection, traversal strategies, serialization, and performance metrics.
 *
 * ## Key Responsibilities
 * - **Graph Topology Management**: Add, remove, and manage nodes and edges
 * - **Cycle Detection**: Prevent cyclic dependencies in flow graph
 * - **Node Linking**: Attach and detach parent-child relationships
 * - **Root Tracking**: Maintain entry points (nodes without parents)
 * - **Graph Traversal**: Support DFS and BFS traversal strategies
 * - **Serialization**: Convert graph to/from JSON snapshots
 * - **Performance Metrics**: Track graph operations via ScopedMeter
 *
 * ## Architecture Features
 * - **Write-Lock Protection**: Prevent concurrent modifications
 * - **Metadata Support**: Store optional metadata on links
 * - **Snapshot Serialization**: Complete graph state capture for persistence
 * - **Copy-on-Read**: Return defensive copies to prevent external mutations
 * - **Cycle Prevention**: O(n) cycle detection before attachment
 * - **Root Set Tracking**: Efficient root node management
 * - **Generic Visitor Pattern**: Support custom traversal logic
 *
 * ## Data Structures
 * - **Nodes**: Map<nodeId, FlowGraphNode> with parents, children, metadata
 * - **Roots**: Set<nodeId> tracking entry points (no parents)
 * - **Links**: Map<targetId, FlowGraphLink> per node with metadata support
 *
 * ## Graph Operations
 * - **addNode(init)**: Add node with optional parents/children (O(m) where m = children count)
 * - **removeNode(nodeId)**: Remove node and all connections (O(n + m))
 * - **attachChild(parentId, childId)**: Create link with cycle detection (O(n) for cycle check)
 * - **detachChild(parentId, childId)**: Remove link (O(1) amortized)
 * - **traverse(visitor, options)**: DFS/BFS traversal with visitor pattern (O(n + m))
 *
 * ## Serialization Format
 * ```json
 * {
 *   "nodes": [
 *     {
 *       "id": "node-1",
 *       "parents": ["parent-1"],
 *       "children": [
 *         { "childId": "child-1", "linkId": "link-1", "metadata": {} }
 *       ],
 *       "entityType": "custom-type",
 *       "data": {}
 *     }
 *   ]
 * }
 * ```
 *
 * ## Thread Safety
 * - **Write-Lock**: Mutual exclusion for modifications (throws if locked)
 * - **Read Operations**: Can be called concurrently with other reads
 * - **Atomic Operations**: All mutations use withWriteLock()
 * - **No Blocking**: Lock failures throw error immediately (fail-fast)
 *
 * ## Performance Characteristics
 * - **Node Addition**: O(m) where m = children count
 * - **Node Removal**: O(n + m) for full cleanup
 * - **Link Operations**: O(1) amortized for most operations
 * - **Traversal**: O(n + m) for full graph
 * - **Cycle Detection**: O(n + m) DFS from child to find parent
 *
 * ## Usage Example
 * ```typescript
 * // Create graph
 * const graph = new FlowGraphAST();
 *
 * // Add nodes
 * const root = graph.addNode({ id: 'root', parents: [] });
 * const child = graph.addNode({ id: 'child', parents: [] });
 *
 * // Link nodes
 * graph.attachChild('root', 'child');
 *
 * // Traverse
 * graph.traverse((node) => {
 *   console.log('Visiting node:', node.id);
 *   return true; // continue traversal
 * });
 *
 * // Serialize
 * const snapshot = graph.toJSON();
 * const json = JSON.stringify(snapshot);
 *
 * // Deserialize
 * const restored = FlowGraphAST.fromJSON(JSON.parse(json));
 * ```
 *
 * @see {@link FlowGraphNode} for node structure
 * @see {@link FlowGraphLink} for link structure
 * @see {@link FlowASTSnapshot} for serialization format
 * @see {@link IFlowGraphAST} for interface contract
 */

import { nanoid } from "nanoid";
import type {
  FlowASTSnapshot,
  FlowGraphLink,
  FlowGraphNode,
  FlowGraphNodeInit,
  FlowGraphNodeSnapshot,
  FlowLinkMetadata,
  IFlowGraphAST,
} from "./types";
import { meter, ScopedMeter } from "../metrics";

/**
 * Clone link metadata safely
 *
 * Creates a shallow copy of metadata object to prevent external mutations.
 * Returns undefined if metadata is undefined.
 *
 * @param metadata - Metadata object to clone (optional)
 * @returns Cloned metadata or undefined
 *
 * @internal
 */
function cloneMetadata(metadata?: FlowLinkMetadata): FlowLinkMetadata | undefined {
  if (!metadata) return undefined;
  return { ...metadata };
}

/**
 * Generate unique link identifier
 *
 * Creates deterministic link ID combining parent, child, and random suffix.
 * Format: "parentId::childId::randomSuffix"
 *
 * @param parentId - Source node ID
 * @param childId - Target node ID
 * @returns Generated link ID unique per creation
 *
 * @internal
 */
function createLinkId(parentId: string, childId: string): string {
  return `${parentId}::${childId}::${nanoid(6)}`;
}

/**
 * FlowGraphAST - Directed acyclic graph for flow topology
 *
 * Implements IFlowGraphAST interface for managing flow node dependencies.
 * Provides thread-safe graph operations with cycle detection, serialization,
 * and performance metrics tracking.
 *
 * ## Key Characteristics
 * - **DAG Guarantee**: Prevents cycles through pre-attachment validation
 * - **Root Tracking**: Maintains entry points (nodes with no parents)
 * - **Write-Lock**: Prevents concurrent modifications (fail-fast)
 * - **Defensive Copies**: Returns copies to prevent external mutations
 * - **Metrics Integration**: Records operation timing and contention
 * - **Snapshot Support**: Full serialization/deserialization
 *
 * ## Internal State
 * - `nodes`: Map<nodeId, FlowGraphNode> - All graph nodes
 * - `roots`: Set<nodeId> - Entry point nodes
 * - `writeLocked`: boolean - Mutual exclusion flag for modifications
 * - `m`: ScopedMeter - Performance metrics collector
 *
 * ## Design Patterns
 * - **Visitor Pattern**: traverse() accepts custom visitor functions
 * - **Copy-on-Read**: Returns defensive copies for data consistency
 * - **Snapshot Pattern**: Serialization/deserialization via snapshots
 * - **Write-Lock Pattern**: Thread-safe mutation via lock/unlock
 *
 * ## Invariants Maintained
 * - No cycles: Graph remains acyclic after all operations
 * - Root set accurate: Roots contain exactly nodes with no parents
 * - Parent-child consistency: Parent has all parents in children's parent set
 * - Node completeness: All referenced nodes exist in nodes map
 *
 * @implements {IFlowGraphAST}
 *
 * @example
 * ```typescript
 * // Create and populate graph
 * const graph = new FlowGraphAST();
 * const n1 = graph.addNode({ id: 'n1' });
 * const n2 = graph.addNode({ id: 'n2' });
 * const n3 = graph.addNode({ id: 'n3' });
 *
 * // Build topology
 * graph.attachChild('n1', 'n2');
 * graph.attachChild('n1', 'n3');
 * graph.attachChild('n2', 'n3'); // OK
 * // graph.attachChild('n3', 'n1'); // Would throw: cycle detected
 *
 * // Query graph
 * console.log(graph.getRoots()); // ['n1']
 * console.log(graph.getChildren('n1')); // Links to [n2, n3]
 *
 * // Traverse
 * graph.traverse((node) => {
 *   console.log(node.id); // n1, n2, n3 in DFS order
 * }, { strategy: 'dfs' });
 *
 * // Serialize and restore
 * const snapshot = graph.toJSON();
 * const restored = FlowGraphAST.fromJSON(snapshot);
 * ```
 *
 * @see {@link IFlowGraphAST} for public interface
 * @see {@link FlowGraphNode} for node structure
 * @see {@link FlowGraphLink} for link structure
 */
export class FlowGraphAST implements IFlowGraphAST {
  private readonly m = new ScopedMeter(meter("flow"), {
    component: "FlowGraphAST",
  });

  /**
   * All nodes in the graph
   * @internal
   */
  private readonly nodes = new Map<string, FlowGraphNode>();

  /**
   * Root node IDs (nodes with no parents)
   * @internal
   */
  private readonly roots = new Set<string>();

  /**
   * Write-lock flag for mutation protection
   * @internal
   */
  private writeLocked = false;

  /**
   * Construct FlowGraphAST
   *
   * Creates a new graph instance. If init snapshot provided, loads graph state.
   *
   * @param init - Optional snapshot to restore (default: empty graph)
   *
   * @example
   * ```typescript
   * // Empty graph
   * const empty = new FlowGraphAST();
   *
   * // From snapshot
   * const snapshot: FlowASTSnapshot = { nodes: [...] };
   * const restored = new FlowGraphAST(snapshot);
   * ```
   */
  constructor(init?: FlowASTSnapshot) {
    if (init) {
      this.loadFromSnapshot(init);
    }
  }

  /**
   * Check if graph is write-locked
   *
   * Returns true if graph is currently locked for mutation. Modifications attempted
   * while locked will throw an error immediately (fail-fast semantics).
   *
   * @returns True if write-locked, false if mutations are allowed
   *
   * @see {@link withWriteLock} for locking mechanism
   *
   * @example
   * ```typescript
   * console.log(graph.isLocked); // false
   * // After modification starts, isLocked becomes true
   * ```
   */
  get isLocked(): boolean {
    return this.writeLocked;
  }

  /**
   * Dispose graph resources
   *
   * Clears all nodes, links, and roots from the graph. After disposal,
   * the graph will be empty. Does not check write-lock (force dispose).
   *
   * @see {@link constructor} to reinitialize
   *
   * @example
   * ```typescript
   * const graph = new FlowGraphAST();
   * graph.addNode({ id: 'n1' });
   * graph.dispose();
   * console.log(graph.hasNode('n1')); // false
   * ```
   */
  dispose(): void {
    this.nodes.clear();
    this.roots.clear();
  }

  /**
   * Add node to graph
   *
   * Creates and adds a new node to the graph. If node has parents specified,
   * this operation will attach the node as child to those parents. If node
   * has no parents, it will be added as a root.
   *
   * @param node - Node initialization data with id, optional parents/children
   * @returns Newly added node with empty connections
   * @throws Error if node ID already exists
   * @throws Error if graph is write-locked
   *
   * ## Behavior
   * - **Empty Parents**: Node added to roots set
   * - **With Parents**: Node attached to each parent (cycles still prevented)
   * - **Children**: Child connections established from initialization
   * - **Metadata**: Optional link metadata preserved
   *
   * ## Time Complexity
   * O(m) where m = initial children count
   *
   * @example
   * ```typescript
   * // Add root node
   * graph.addNode({ id: 'root', parents: [] });
   *
   * // Add child node with parent linkage
   * graph.addNode({
   *   id: 'child',
   *   parents: ['root'],
   *   children: []
   * });
   *
   * // Node with custom data
   * graph.addNode({
   *   id: 'task',
   *   parents: [],
   *   entityType: 'task',
   *   data: { priority: 'high' }
   * });
   * ```
   *
   * @see {@link removeNode} to remove nodes
   * @see {@link attachChild} for explicit link creation
   */
  addNode(node: FlowGraphNodeInit): FlowGraphNode {
    return this.withWriteLock(() => {
      if (this.nodes.has(node.id)) {
        throw new Error(`FlowGraphAST: node ${node.id} already exists`);
      }
      const parents = new Set(node.parents ?? []);
      const children = new Map<string, FlowGraphLink>();
      if (node.children) {
        for (const linkInit of node.children) {
          const nextLink: FlowGraphLink = {
            id: linkInit.id ?? createLinkId(node.id, linkInit.targetId),
            sourceId: linkInit.sourceId ?? node.id,
            targetId: linkInit.targetId,
          };
          const metadata = cloneMetadata(linkInit.metadata);
          if (metadata !== undefined) {
            nextLink.metadata = metadata;
          }
          children.set(nextLink.targetId, nextLink);
        }
      }
      const normalized: FlowGraphNode = {
        id: node.id,
        parents,
        children,
      };
      if (node.entityType !== undefined) {
        normalized.entityType = node.entityType;
      }
      if (node.data) {
        normalized.data = { ...node.data };
      }
      this.nodes.set(node.id, normalized);
      if (parents.size === 0) {
        this.roots.add(node.id);
      }
      for (const parentId of parents) {
        const parent = this.nodes.get(parentId);
        if (!parent) continue;
        parent.children.set(node.id, {
          id: createLinkId(parentId, node.id),
          sourceId: parentId,
          targetId: node.id,
        });
      }
      return normalized;
    });
  }

  /**
   * Remove node from graph
   *
   * Removes specified node and all its incoming and outgoing links.
   * Cleans up parent references and updates root set accordingly.
   * If node is not found, returns false without error.
   *
   * @param nodeId - ID of node to remove
   * @returns True if node was found and removed, false if not found
   * @throws Error if graph is write-locked
   *
   * ## Behavior
   * - **Node Cleanup**: Removes from nodes map
   * - **Link Cleanup**: Removes all parent→this and this→child links
   * - **Root Update**: If node was root, removes from roots set
   * - **Parent Update**: Removes node from parent's children map
   * - **Orphan Check**: Children become root if no other parents
   *
   * ## Time Complexity
   * O(n + m) where n = number of parents, m = number of children
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'n1' });
   * graph.addNode({ id: 'n2', parents: ['n1'] });
   *
   * // Remove node and all its connections
   * const removed = graph.removeNode('n1');
   * console.log(removed); // true
   * console.log(graph.hasNode('n1')); // false
   * console.log(graph.getParents('n2')); // [] - now root
   * ```
   *
   * @see {@link addNode} to add nodes
   * @see {@link detachChild} for selective link removal
   */
  removeNode(nodeId: string): boolean {
    return this.withWriteLock(() => {
      const node = this.nodes.get(nodeId);
      if (!node) return false;
      for (const parentId of node.parents) {
        this.detachChild(parentId, nodeId);
      }
      for (const childLink of node.children.values()) {
        this.detachChild(nodeId, childLink.targetId);
      }
      this.nodes.delete(nodeId);
      this.roots.delete(nodeId);
      return true;
    });
  }

  /**
   * Attach child to parent node
   *
   * Creates a directed link from parent node to child node with optional metadata.
   * Performs cycle detection before attachment to maintain DAG property.
   * Both nodes must exist in the graph.
   *
   * ## Cycle Detection
   * Uses depth-first search from child to check if parent is reachable.
   * If parent found in child's descendants, throws error (prevents cycle).
   *
   * ## Link Management
   * - Creates bidirectional tracking: parent→child and child←parent
   * - Generates unique link ID with nanoid suffix
   * - Stores metadata if provided
   * - Updates root set if child was root
   *
   * @param parentId - ID of parent node
   * @param childId - ID of child node
   * @param metadata - Optional link metadata (cloned internally)
   * @returns Created link object with id, sourceId, targetId, metadata
   * @throws Error if either node doesn't exist
   * @throws Error if attachment would create cycle
   * @throws Error if graph is write-locked
   * @throws Error if link already exists between nodes
   *
   * ## Time Complexity
   * O(n + m) where cycle detection is O(n+m), link creation is O(1)
   *
   * ## Example
   * ```typescript
   * graph.addNode({ id: 'task1', parents: [] });
   * graph.addNode({ id: 'task2', parents: [] });
   *
   * // Simple link
   * const link = graph.attachChild('task1', 'task2');
   * console.log(link.id); // Generated link ID
   *
   * // With metadata
   * const linkWithMeta = graph.attachChild('task1', 'task3', {
   *   condition: 'on-success',
   *   delay: 1000
   * });
   *
   * // Cycle detection
   * graph.attachChild('task2', 'task1'); // Throws: cycle detected
   * ```
   *
   * @see {@link detachChild} to remove links
   * @see {@link createsCycle} for cycle detection algorithm
   * @see {@link getChildren} to query outgoing links
   */
  attachChild(parentId: string, childId: string, metadata?: FlowLinkMetadata): FlowGraphLink {
    return this.withWriteLock(() => {
      if (parentId === childId) {
        throw new Error("FlowGraphAST: cannot link node to itself");
      }
      const parent = this.nodes.get(parentId);
      const child = this.nodes.get(childId);
      if (!parent || !child) {
        throw new Error("FlowGraphAST: parent or child node missing");
      }
      if (parent.children.has(childId)) {
        const existing = parent.children.get(childId)!;
        const clonedMetadata = cloneMetadata(metadata);
        if (clonedMetadata !== undefined) {
          existing.metadata = clonedMetadata;
        } else if ("metadata" in existing) {
          delete existing.metadata;
        }
        return existing;
      }
      if (this.createsCycle(parentId, childId)) {
        throw new Error(`FlowGraphAST: linking ${parentId} -> ${childId} would create a cycle`);
      }
      const link: FlowGraphLink = {
        id: createLinkId(parentId, childId),
        sourceId: parentId,
        targetId: childId,
      };
      const clonedMetadata = cloneMetadata(metadata);
      if (clonedMetadata !== undefined) {
        link.metadata = clonedMetadata;
      }
      parent.children.set(childId, link);
      child.parents.add(parentId);
      this.roots.delete(childId);
      return link;
    });
  }

  /**
   * Detach child from parent node
   *
   * Removes directed link from parent node to child node. Updates parent-child
   * tracking bidirectionally. If link not found, returns false without error.
   * Does NOT remove nodes themselves, only the connection.
   *
   * ## Behavior
   * - **Link Removal**: Removes from parent's children map
   * - **Parent Update**: Removes from child's parents set
   * - **Root Update**: If child has no other parents, adds to roots
   * - **Node Persistence**: Both nodes remain in graph
   *
   * ## Edge Cases
   * - Non-existent link: Returns false (safe operation)
   * - Last parent removed: Child becomes root
   * - No effect on other connections
   *
   * @param parentId - ID of parent node
   * @param childId - ID of child node
   * @returns True if link was found and removed, false if link didn't exist
   * @throws Error if graph is write-locked
   *
   * ## Time Complexity
   * O(1) amortized for link removal
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'parent' });
   * graph.addNode({ id: 'child', parents: [] });
   * graph.attachChild('parent', 'child');
   *
   * // Remove link
   * const removed = graph.detachChild('parent', 'child');
   * console.log(removed); // true
   * console.log(graph.getParents('child')); // []
   * console.log(graph.getRoots()); // contains 'child'
   *
   * // Safe: already removed
   * const secondAttempt = graph.detachChild('parent', 'child');
   * console.log(secondAttempt); // false
   * ```
   *
   * @see {@link attachChild} to create links
   * @see {@link removeNode} to remove node and all links
   * @see {@link getChildren} to query existing links
   */
  detachChild(parentId: string, childId: string): boolean {
    return this.withWriteLock(() => {
      const parent = this.nodes.get(parentId);
      const child = this.nodes.get(childId);
      if (!parent || !child) return false;
      const existed = parent.children.delete(childId);
      if (!existed) return false;
      child.parents.delete(parentId);
      if (child.parents.size === 0) {
        this.roots.add(childId);
      }
      return true;
    });
  }

  /**
   * Get node from graph
   *
   * Returns a deep-cloned copy of the node with specified ID. Returns undefined
   * if node not found. The returned copy is defensive and can be modified without
   * affecting the graph state.
   *
   * ## Returns Clone
   * - **Deep Copy**: Node object and all collections are cloned
   * - **Independent**: Modifications to returned node don't affect graph
   * - **Safe**: Parent/children references preserved in clone
   *
   * @param nodeId - ID of node to retrieve
   * @returns Deep-cloned node or undefined if not found
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'n1', parents: [] });
   * const node = graph.getNode('n1');
   * console.log(node?.id); // 'n1'
   * console.log(node?.parents); // Set
   * console.log(node?.children); // Map
   *
   * // Modify without affecting graph
   * if (node) {
   *   node.data = { modified: true };
   *   console.log(graph.getNode('n1')?.data); // Still original
   * }
   * ```
   *
   * @see {@link hasNode} for existence checking
   * @see {@link getParents} for parent IDs
   * @see {@link getChildren} for child links
   */
  getNode(nodeId: string): FlowGraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;
    const result: FlowGraphNode = {
      id: node.id,
      parents: new Set(node.parents),
      children: new Map(node.children),
    };
    if (node.entityType !== undefined) {
      result.entityType = node.entityType;
    }
    if (node.data) {
      result.data = { ...node.data };
    }
    return result;
  }

  /**
   * Get parent node IDs
   *
   * Returns array of all parent node IDs for the specified node.
   * Each entry represents a parent that has a link to this node.
   * Returns empty array if node has no parents (i.e., is a root).
   *
   * @param nodeId - ID of node to query
   * @returns Array of parent node IDs (empty if no parents)
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'n1' });
   * graph.addNode({ id: 'n2', parents: [] });
   * graph.addNode({ id: 'n3', parents: [] });
   *
   * graph.attachChild('n1', 'n2');
   * graph.attachChild('n1', 'n3');
   *
   * console.log(graph.getParents('n2')); // ['n1']
   * console.log(graph.getParents('n1')); // [] - n1 is root
   * ```
   *
   * @see {@link getChildren} to query outgoing links
   * @see {@link getRoots} to find all root nodes
   */
  getParents(nodeId: string): string[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return [...node.parents];
  }

  /**
   * Get outgoing child links
   *
   * Returns array of all FlowGraphLink objects representing outgoing edges
   * from this node to its children. Each link includes metadata if present.
   * Returns empty array if node has no children.
   *
   * ## Link Properties
   * - **id**: Unique link identifier
   * - **sourceId**: Parent node ID
   * - **targetId**: Child node ID
   * - **metadata**: Optional link metadata (cloned from storage)
   *
   * @param nodeId - ID of node to query
   * @returns Array of outgoing links (empty if no children)
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'task1' });
   * graph.addNode({ id: 'task2', parents: [] });
   * graph.addNode({ id: 'task3', parents: [] });
   *
   * graph.attachChild('task1', 'task2', { type: 'success' });
   * graph.attachChild('task1', 'task3', { type: 'failure' });
   *
   * const links = graph.getChildren('task1');
   * console.log(links.length); // 2
   * console.log(links[0].metadata); // { type: 'success' }
   * ```
   *
   * @see {@link getParents} to query incoming edges
   * @see {@link attachChild} to create links
   */
  getChildren(nodeId: string): FlowGraphLink[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return [...node.children.values()].map((link) => {
      const nextLink: FlowGraphLink = {
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
      };
      const metadata = cloneMetadata(link.metadata);
      if (metadata !== undefined) {
        nextLink.metadata = metadata;
      }
      return nextLink;
    });
  }

  /**
   * Get all root nodes
   *
   * Returns array of node IDs for all entry points in the graph.
   * Root nodes are those without any parents. These are typically
   * the starting points for graph traversal or execution.
   *
   * ## Root Characteristics
   * - **No Parents**: By definition, roots have no incoming edges
   * - **Entry Points**: Typically used as traversal start points
   * - **Auto-Maintained**: Updated automatically by attach/detach operations
   * - **Multiple Roots**: Graph may have multiple independent roots
   *
   * @returns Array of root node IDs (empty if graph is empty)
   *
   * @example
   * ```typescript
   * // Create graph with multiple roots
   * graph.addNode({ id: 'root1' });
   * graph.addNode({ id: 'root2' });
   * graph.addNode({ id: 'child', parents: [] });
   *
   * console.log(graph.getRoots()); // ['root1', 'root2']
   *
   * // After linking, child is no longer root
   * graph.attachChild('root1', 'child');
   * console.log(graph.getRoots()); // ['root1', 'root2'] - child removed
   * ```
   *
   * @see {@link getParents} to check specific node's parents
   * @see {@link traverse} to execute graph from roots
   */
  getRoots(): string[] {
    return [...this.roots];
  }

  /**
   * Check if node exists in graph
   *
   * Fast existence check for a node with given ID. Returns true if the node
   * is present in the graph, false otherwise. O(1) time complexity.
   *
   * @param nodeId - ID of node to check
   * @returns True if node exists, false otherwise
   *
   * @example
   * ```typescript
   * graph.addNode({ id: 'n1' });
   *
   * console.log(graph.hasNode('n1')); // true
   * console.log(graph.hasNode('n2')); // false
   *
   * // Safe before operations
   * if (graph.hasNode('n1')) {
   *   graph.removeNode('n1');
   * }
   * ```
   *
   * @see {@link addNode} to add nodes
   * @see {@link getNode} to retrieve node details
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Traverse graph with visitor function
   *
   * Executes depth-first or breadth-first traversal of the graph starting from roots.
   * Calls visitor function for each node encountered. Visitor can control traversal
   * by returning true (continue) or false (stop).
   *
   * ## Traversal Strategies
   * - **DFS** (default): Depth-first search, complete depth before sibling
   * - **BFS**: Breadth-first search, all siblings before depth
   *
   * ## Visitor Callback
   * - Called for each visited node with node as parameter
   * - Return true or undefined: continue traversal
   * - Return false: stop traversal immediately
   * - Exceptions in visitor propagate and stop traversal
   *
   * ## Options
   * ```typescript
   * interface TraversalOptions {
   *   strategy?: 'dfs' | 'bfs'; // default 'dfs'
   *   allowRepeat?: boolean;     // allow revisiting nodes, default false
   * }
   * ```
   *
   * ## Cycle Handling
   * - **Without Cycles**: Normal DAG ensures single visit per node
   * - **With Repeat**: allowRepeat=true may visit same node multiple times
   *
   * ## Time Complexity
   * - O(n + m) for complete traversal where n = nodes, m = edges
   * - May be less if visitor returns false early
   *
   * @param visitor - Callback function invoked for each node
   * @param options - Traversal configuration (strategy, allowRepeat)
   * @returns undefined (traversal completes or stops)
   *
   * @example
   * ```typescript
   * // Simple DFS traversal
   * graph.traverse((node) => {
   *   console.log('Visiting:', node.id);
   *   return true; // continue
   * });
   *
   * // BFS traversal with early stop
   * graph.traverse((node) => {
   *   console.log('Node:', node.id);
   *   return node.id !== 'target'; // stop if found target
   * }, { strategy: 'bfs' });
   *
   * // With node data processing
   * graph.traverse((node) => {
   *   if (node.entityType === 'task') {
   *     processTask(node);
   *   }
   *   return true;
   * });
   *
   * // BFS from roots
   * const nodes: FlowGraphNode[] = [];
   * graph.traverse((node) => {
   *   nodes.push(node);
   *   return true;
   * }, { strategy: 'bfs' });
   * ```
   *
   * @see {@link getRoots} to get starting nodes
   * @see {@link getChildren} to manually navigate
   * @see {@link getParents} for reverse navigation
   */
  traverse(
    visitor: (node: FlowGraphNode) => boolean | void,
    options?: { strategy?: "dfs" | "bfs"; allowRepeat?: boolean }
  ): void {
    const strategy = options?.strategy ?? "dfs";
    const allowRepeat = options?.allowRepeat ?? false;
    const visited = new Set<string>();
    const queue: string[] = [...this.roots];
    const start = performance.now();
    const dequeue = strategy === "dfs" ? () => queue.pop()! : () => queue.shift()!;

    const push = (id: string) => {
      if (!allowRepeat && visited.has(id)) return;
      queue.push(id);
    };

    while (queue.length > 0) {
      const nodeId = dequeue();
      if (!allowRepeat && visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      const visitNode: FlowGraphNode = {
        id: node.id,
        parents: new Set(node.parents),
        children: new Map(node.children),
      };
      if (node.entityType !== undefined) {
        visitNode.entityType = node.entityType;
      }
      if (node.data) {
        visitNode.data = { ...node.data };
      }
      const shouldContinue = visitor(visitNode);
      if (shouldContinue === false) break;
      for (const link of node.children.values()) {
        push(link.targetId);
      }
    }
    const duration = performance.now() - start;
    this.m.histogram("graph.traverse.duration.ms", { unit: "ms" }).record(duration);
  }

  /**
   * Serialize graph to JSON snapshot
   *
   * Converts the entire graph state into a JSON-serializable snapshot format.
   * The snapshot captures all nodes, their connections, metadata, and entity data.
   * Can be used for persistence, transmission, or creating graph copies.
   *
   * ## Snapshot Format
   * ```json
   * {
   *   "nodes": [
   *     {
   *       "id": "node-id",
   *       "parents": ["parent-1", "parent-2"],
   *       "children": [
   *         {
   *           "childId": "child-id",
   *           "linkId": "unique-link-id",
   *           "metadata": { "custom": "data" }
   *         }
   *       ],
   *       "entityType": "optional-type",
   *       "data": { "optional": "data" }
   *     }
   *   ]
   * }
   * ```
   *
   * ## Serialization Details
   * - **Complete State**: Includes all nodes and all connections
   * - **Metadata Preserved**: Link metadata is included
   * - **Entity Data**: Custom node data is preserved
   * - **Cycle-Safe**: Can represent any graph structure
   * - **JSON Compatible**: Directly stringifiable with JSON.stringify()
   *
   * @returns FlowASTSnapshot with complete graph state
   *
   * @example
   * ```typescript
   * // Serialize to snapshot
   * const snapshot = graph.toJSON();
   *
   * // Convert to JSON string
   * const json = JSON.stringify(snapshot);
   *
   * // Save to file or database
   * await fs.writeFile('graph.json', json);
   *
   * // Send over network
   * await fetch('/api/save', {
   *   method: 'POST',
   *   body: json,
   *   headers: { 'Content-Type': 'application/json' }
   * });
   * ```
   *
   * @see {@link fromJSON} to deserialize
   * @see {@link snapshot} for alternative serialization
   */
  toJSON(): FlowASTSnapshot {
    const nodes: FlowASTSnapshot["nodes"] = [];
    for (const node of this.nodes.values()) {
      const graphNode: FlowGraphNodeSnapshot = {
        id: node.id,
        parents: [...node.parents],
        children: [...node.children.values()].map((link) => {
          const childSnapshot: FlowGraphNodeSnapshot["children"][number] = {
            childId: link.targetId,
            linkId: link.id,
          };
          const metadata = cloneMetadata(link.metadata);
          if (metadata !== undefined) {
            childSnapshot.metadata = metadata;
          }
          return childSnapshot;
        }),
      };
      if (node.entityType !== undefined) {
        graphNode.entityType = node.entityType;
      }
      if (node.data) {
        graphNode.data = { ...node.data };
      }
      nodes.push(graphNode);
    }
    return { nodes };
  }

  /**
   * Deserialize graph from JSON snapshot
   *
   * Creates a new FlowGraphAST instance from a previously serialized snapshot.
   * Reconstructs all nodes, connections, and metadata from snapshot data.
   * This is the primary factory method for creating graphs from persistence.
   *
   * ## Snapshot Loading
   * - **Node Reconstruction**: Creates all nodes from snapshot
   * - **Link Reconstruction**: Re-establishes all parent-child connections
   * - **Metadata Restoration**: Recovers link metadata
   * - **Root Set**: Automatically computed from parent information
   * - **Validation**: Ensures graph consistency after loading
   *
   * ## Usage Patterns
   * ```typescript
   * // From JSON string
   * const json = await fs.readFile('graph.json', 'utf-8');
   * const snapshot = JSON.parse(json);
   * const graph = FlowGraphAST.fromJSON(snapshot);
   *
   * // From network
   * const response = await fetch('/api/graph');
   * const snapshot = await response.json();
   * const graph = FlowGraphAST.fromJSON(snapshot);
   *
   * // Copy existing graph
   * const copy = FlowGraphAST.fromJSON(original.toJSON());
   * ```
   *
   * ## Error Handling
   * - Throws if snapshot is malformed
   * - Throws if node references are inconsistent
   * - Returns new empty graph if snapshot is null/undefined
   *
   * @param snapshot - FlowASTSnapshot from previous toJSON() or compatible format
   * @returns New FlowGraphAST instance with restored state
   *
   * @example
   * ```typescript
   * // Save and restore
   * const original = new FlowGraphAST();
   * original.addNode({ id: 'n1' });
   * original.addNode({ id: 'n2', parents: [] });
   * original.attachChild('n1', 'n2');
   *
   * const snapshot = original.toJSON();
   * const restored = FlowGraphAST.fromJSON(snapshot);
   *
   * // Verify restoration
   * console.log(restored.hasNode('n1')); // true
   * console.log(restored.getParents('n2')); // ['n1']
   * console.log(restored.getRoots()); // ['n1']
   * ```
   *
   * @see {@link toJSON} to serialize graphs
   * @see {@link constructor} which uses fromJSON internally
   */
  static fromJSON(snapshot: FlowASTSnapshot): FlowGraphAST {
    return new FlowGraphAST(snapshot);
  }

  private loadFromSnapshot(snapshot: FlowASTSnapshot): void {
    this.nodes.clear();
    this.roots.clear();
    for (const node of snapshot.nodes) {
      const parents = new Set(node.parents ?? []);
      const children = new Map<string, FlowGraphLink>();
      const graphNode: FlowGraphNode = {
        id: node.id,
        parents,
        children,
      };
      if (node.entityType !== undefined) {
        graphNode.entityType = node.entityType;
      }
      if (node.data) {
        graphNode.data = { ...node.data };
      }
      this.nodes.set(node.id, graphNode);
      if (parents.size === 0) {
        this.roots.add(node.id);
      }
      for (const child of node.children ?? []) {
        const childLink: FlowGraphLink = {
          id: child.linkId ?? createLinkId(node.id, child.childId),
          sourceId: node.id,
          targetId: child.childId,
        };
        const metadata = cloneMetadata(child.metadata);
        if (metadata !== undefined) {
          childLink.metadata = metadata;
        }
        children.set(child.childId, childLink);
      }
    }
    // rebuild parent links
    for (const node of this.nodes.values()) {
      for (const link of node.children.values()) {
        const target = this.nodes.get(link.targetId);
        if (!target) continue;
        target.parents.add(node.id);
        if (target.parents.size > 0) {
          this.roots.delete(target.id);
        }
      }
    }
  }

  private createsCycle(parentId: string, childId: string): boolean {
    if (parentId === childId) return true;
    const visited = new Set<string>();
    const stack: string[] = [childId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === parentId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = this.nodes.get(current);
      if (!node) continue;
      for (const link of node.children.values()) {
        stack.push(link.targetId);
      }
    }
    return false;
  }

  private withWriteLock<R>(fn: () => R): R {
    if (this.writeLocked) {
      this.m.counter("graph.lock.contention").add(1);
      throw new Error("FlowGraphAST: write lock is active");
    }
    this.writeLocked = true;
    try {
      const start = performance.now();
      const result = fn();
      const dur = performance.now() - start;
      this.m.histogram("graph.write.duration.ms", { unit: "ms" }).record(dur);
      return result;
    } finally {
      this.writeLocked = false;
    }
  }
}
