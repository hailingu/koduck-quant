/**
 * @file Example Flow Entity Components
 * @description Exports for example node and edge components demonstrating
 * the Flow Entity extension API.
 *
 * @see docs/reference/flow-entity-extension-api.md
 */

// Node Components
export { DecisionNode, createDecisionNode, DECISION_FORM_SCHEMA } from "./DecisionNode";
export type { DecisionNodeProps, DecisionFormData } from "./DecisionNode";

export { ActionNode, createActionNode, ACTION_FORM_SCHEMA } from "./ActionNode";
export type { ActionNodeProps, ActionNodeConfig } from "./ActionNode";

export { StartNode, createStartNode, START_FORM_SCHEMA } from "./StartNode";
export type { StartNodeProps, StartNodeConfig } from "./StartNode";

export { EndNode, createEndNode, END_FORM_SCHEMA } from "./EndNode";
export type { EndNodeProps, EndNodeConfig } from "./EndNode";

// Edge Factories
export { createConditionalEdge } from "./ConditionalEdge";
export type { ConditionalEdgeConfig } from "./ConditionalEdge";
