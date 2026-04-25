/**
 * @file HttpRequestNode Component
 * @description Demo node component demonstrating form integration with BaseFlowNode.
 * An HTTP Request node with URL and method configuration fields rendered directly in the node.
 *
 * This is an example implementation showing how:
 * - formSchema defines the node's configuration form
 * - FlowNodeContent automatically renders FlowNodeForm when formSchema exists
 * - Form changes update the entity's form data
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.9
 */

import React, { useMemo } from "react";
import { FlowNodeEntity } from "../../../../common/flow/flow-node-entity";
import type { FormSchema, PortDefinition } from "../../types";
import { BaseFlowNode } from "../BaseFlowNode";

// =============================================================================
// Constants
// =============================================================================

/**
 * HTTP methods available for the request node
 */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * Default HTTP method
 */
export const DEFAULT_HTTP_METHOD = "GET";

/**
 * Content types for request body
 */
export const CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
  "text/xml",
] as const;

/**
 * Form schema for HTTP Request node configuration
 */
export const HTTP_REQUEST_FORM_SCHEMA: FormSchema = {
  type: "object",
  properties: {
    url: {
      type: "text",
      label: "URL",
      description: "The request URL endpoint",
      placeholder: "https://api.example.com/endpoint",
      validation: {
        required: true,
        pattern: "^https?://",
      },
      order: 1,
    },
    method: {
      type: "select",
      label: "Method",
      description: "HTTP request method",
      defaultValue: DEFAULT_HTTP_METHOD,
      options: HTTP_METHODS.map((method) => ({
        label: method,
        value: method,
      })),
      validation: {
        required: true,
      },
      order: 2,
    },
    headers: {
      type: "object",
      label: "Headers",
      description: "Request headers (key-value pairs)",
      order: 3,
      defaultValue: {},
    },
    body: {
      type: "textarea",
      label: "Request Body",
      description: "Request body content (for POST, PUT, PATCH)",
      placeholder: '{"key": "value"}',
      order: 4,
      visible: {
        field: "method",
        operator: "in",
        value: ["POST", "PUT", "PATCH"],
      },
    },
    contentType: {
      type: "select",
      label: "Content-Type",
      description: "Content type for request body",
      defaultValue: "application/json",
      options: CONTENT_TYPES.map((type) => ({
        label: type,
        value: type,
      })),
      order: 5,
      visible: {
        field: "method",
        operator: "in",
        value: ["POST", "PUT", "PATCH"],
      },
    },
    timeout: {
      type: "number",
      label: "Timeout (ms)",
      description: "Request timeout in milliseconds",
      defaultValue: 30000,
      validation: {
        min: 0,
        max: 300000,
      },
      order: 6,
    },
  },
  required: ["url", "method"],
  layout: {
    direction: "vertical",
    spacing: "normal",
    labelPosition: "top",
  },
};

/**
 * Default port definitions for HTTP Request node
 */
export const HTTP_REQUEST_PORTS: PortDefinition[] = [
  {
    id: "input",
    name: "Input",
    type: "input",
    dataType: "any",
    position: { x: 0, y: 50 },
    maxConnections: 1,
  },
  {
    id: "output-success",
    name: "Success",
    type: "output",
    dataType: "object",
    position: { x: 200, y: 40 },
  },
  {
    id: "output-error",
    name: "Error",
    type: "output",
    dataType: "object",
    position: { x: 200, y: 70 },
  },
];

// =============================================================================
// Types
// =============================================================================

/**
 * HTTP Request node form data structure
 */
export interface HttpRequestFormData {
  /** The request URL */
  url: string;
  /** HTTP method */
  method: (typeof HTTP_METHODS)[number];
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string;
  /** Content type */
  contentType?: (typeof CONTENT_TYPES)[number];
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Props for HttpRequestNode component
 */
export interface HttpRequestNodeProps {
  /** The flow node entity */
  entity: FlowNodeEntity;
  /** Whether the node is selected */
  selected?: boolean;
  /** Callback when the node is selected */
  onSelect?: (entity: FlowNodeEntity) => void;
  /** Callback when form values change */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;
  /** Additional CSS class */
  className?: string;
  /** Test ID */
  testId?: string;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new HTTP Request node entity with default configuration.
 *
 * @param options - Optional initial configuration
 * @param options.position
 * @param options.position.x
 * @param options.position.y
 * @param options.formData
 * @returns A new FlowNodeEntity configured as an HTTP Request node
 *
 * @example
 * ```typescript
 * const httpNode = createHttpRequestNode({
 *   position: { x: 100, y: 100 },
 *   formData: { url: 'https://api.example.com', method: 'POST' }
 * });
 * ```
 */
export function createHttpRequestNode(options?: {
  position?: { x: number; y: number };
  formData?: Partial<HttpRequestFormData>;
}): FlowNodeEntity {
  const entity = new FlowNodeEntity({
    nodeType: "http-request",
    label: "HTTP Request",
    position: options?.position ?? { x: 0, y: 0 },
    size: { width: 280, height: 320 },
    formSchema: HTTP_REQUEST_FORM_SCHEMA,
    config: {
      url: "",
      method: DEFAULT_HTTP_METHOD,
      timeout: 30000,
      ...options?.formData,
    },
  });

  // Set ports
  entity.setPorts(HTTP_REQUEST_PORTS);

  return entity;
}

// =============================================================================
// Component
// =============================================================================

/**
 * HttpRequestNode - Demo node for HTTP requests
 *
 * Demonstrates form integration with BaseFlowNode:
 * - Uses formSchema to define configuration fields
 * - FlowNodeContent automatically renders the form
 * - Form changes persist to entity.config
 *
 * @example
 * ```tsx
 * const httpEntity = createHttpRequestNode({
 *   position: { x: 100, y: 100 }
 * });
 *
 * <HttpRequestNode
 *   entity={httpEntity}
 *   selected={selectedId === httpEntity.id}
 *   onSelect={(e) => setSelectedId(e.id)}
 *   onFormChange={(e, values) => console.log('Form changed:', values)}
 * />
 * ```
 */
export const HttpRequestNode: React.FC<HttpRequestNodeProps> = React.memo(function HttpRequestNode({
  entity,
  selected = false,
  onSelect,
  onFormChange,
  className,
  testId,
}) {
  // Memoize the form change handler
  const handleFormChange = useMemo(() => {
    if (!onFormChange) return undefined;
    return (nodeEntity: FlowNodeEntity, values: Record<string, unknown>) => {
      onFormChange(nodeEntity, values);
    };
  }, [onFormChange]);

  return (
    <BaseFlowNode
      entity={entity}
      selected={selected}
      onSelect={onSelect}
      onFormChange={handleFormChange}
      renderMode="default"
      className={className}
      data-testid={testId ?? `http-request-node-${entity.id}`}
    />
  );
});

// Default export for convenience
export default HttpRequestNode;
