/**
 * @file Demo Nodes Module Index
 * @description Exports for demo node components demonstrating form integration.
 *
 * These are example implementations showing how to create nodes with
 * schema-driven forms that render directly within the node content area.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.9
 */

// =============================================================================
// HTTP Request Node
// =============================================================================

export {
  HttpRequestNode,
  default as HttpRequestNodeDefault,
  createHttpRequestNode,
  HTTP_METHODS,
  DEFAULT_HTTP_METHOD,
  CONTENT_TYPES,
  HTTP_REQUEST_FORM_SCHEMA,
  HTTP_REQUEST_PORTS,
  type HttpRequestFormData,
  type HttpRequestNodeProps,
} from "./HttpRequestNode";
