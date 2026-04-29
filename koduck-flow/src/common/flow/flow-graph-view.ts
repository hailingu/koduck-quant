import type { FlowGraphLink, FlowGraphNodeSnapshot, IFlowGraphAST, OptionalProp } from "./types";

/**
 * @module src/common/flow/flow-graph-view
 * @description Flow graph tree projection module. Converts flat graph representations
 * into tree structures for hierarchical traversal and visualization
 */

/**
 * Options for tree building from flow graph
 * @typedef {Object} TreeBuilderOptions
 * @property {string[]} [rootIds] - Specific root node IDs to build from.
 * If omitted, all roots from graph are used
 * @property {number} [maxDepth] - Maximum depth for tree traversal.
 * Defaults to Number.POSITIVE_INFINITY (unlimited)
 * @property {boolean} [dedupe] - Whether to deduplicate nodes across branches.
 * Defaults to false. If true, each node appears in only one branch
 */
type TreeBuilderOptions = {
  rootIds?: string[];
  maxDepth?: number;
  dedupe?: boolean;
};

/**
 * Tree representation of a flow graph node with hierarchical structure
 * @typedef {Object} FlowGraphTreeNode
 * @property {string} id - Node identifier from the graph
 * @property {OptionalProp<string>} entityType - Entity type of the node
 * @property {OptionalProp<FlowGraphNodeSnapshot["data"]>} data - Node payload data
 * @property {OptionalProp<FlowGraphLink["metadata"]>} linkMetadata - Metadata from incoming link to parent,
 * undefined for root nodes
 * @property {FlowGraphTreeNode[]} children - Child nodes in the tree structure
 */
export type FlowGraphTreeNode = {
  id: string;
  entityType: OptionalProp<string>;
  data: OptionalProp<FlowGraphNodeSnapshot["data"]>;
  linkMetadata: OptionalProp<FlowGraphLink["metadata"]>;
  children: FlowGraphTreeNode[];
};

/**
 * Project a flow graph into a tree or forest structure
 * Converts graph node relationships into hierarchical parent-child tree structure
 * with support for depth limiting and deduplication
 * @param {IFlowGraphAST} graph - Source flow graph to project
 * @param {TreeBuilderOptions} [options] - Configuration for tree building
 * @param {string[]} [options.rootIds] - Specific root node IDs to use,
 * defaults to all graph roots
 * @param {number} [options.maxDepth] - Maximum tree depth, prevents infinite traversal
 * @param {boolean} [options.dedupe] - Enable deduplication to prevent node duplication
 * across branches (only appears in first branch encountered)
 * @returns {FlowGraphTreeNode[]} Array of tree roots (forest),
 * empty if no valid roots found
 * @example
 * const forest = projectFlowGraphToTree(graph, {
 *   maxDepth: 5,
 *   dedupe: true
 * });
 * // forest[0].children[0].id === 'some-node-id'
 */
export function projectFlowGraphToTree(
  graph: IFlowGraphAST,
  options: TreeBuilderOptions = {}
): FlowGraphTreeNode[] {
  const roots = options.rootIds?.length ? options.rootIds : graph.getRoots();
  const dedupe = options.dedupe ?? false;
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const globallyVisited = dedupe ? new Set<string>() : null;

  const buildNode = (
    nodeId: string,
    depth: number,
    path: Set<string>
  ): FlowGraphTreeNode | null => {
    if (depth > maxDepth) return null;
    if (path.has(nodeId)) return null;
    const node = graph.getNode(nodeId);
    if (!node) return null;

    const nextPath = new Set(path);
    nextPath.add(nodeId);

    const children: FlowGraphTreeNode[] = [];
    for (const childLink of graph.getChildren(nodeId)) {
      if (globallyVisited?.has(childLink.targetId)) {
        continue;
      }
      const childTree = buildNode(childLink.targetId, depth + 1, nextPath);
      if (!childTree) continue;
      children.push({
        ...childTree,
        linkMetadata: childLink.metadata ? { ...childLink.metadata } : undefined,
      });
      globallyVisited?.add(childLink.targetId);
    }

    return {
      id: node.id,
      entityType: node.entityType,
      data: node.data ? { ...node.data } : undefined,
      linkMetadata: undefined,
      children,
    };
  };

  const forest: FlowGraphTreeNode[] = [];
  for (const rootId of roots) {
    if (!rootId) continue;
    const tree = buildNode(rootId, 0, new Set());
    if (tree) {
      forest.push(tree);
    }
  }

  return forest;
}
