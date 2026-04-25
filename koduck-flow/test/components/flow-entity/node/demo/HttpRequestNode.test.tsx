/**
 * @file HttpRequestNode Tests
 * @description Tests for the HTTP Request demo node component.
 * Verifies form integration, entity creation, and data persistence.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.9
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  HttpRequestNode,
  createHttpRequestNode,
  HTTP_REQUEST_FORM_SCHEMA,
  HTTP_REQUEST_PORTS,
  HTTP_METHODS,
  CONTENT_TYPES,
  DEFAULT_HTTP_METHOD,
} from "../../../../../src/components/flow-entity/node/demo/HttpRequestNode";
import { FlowEntityProvider } from "../../../../../src/components/flow-entity/context";
import type { FlowEntityTheme } from "../../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Default theme for testing
 */
const defaultTheme: FlowEntityTheme = {
  node: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    textColor: "#1e293b",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    headerBackgroundColor: "#f8fafc",
    headerTextColor: "#475569",
    headerHeight: 40,
    executionStateColors: {
      idle: "#94a3b8",
      pending: "#fbbf24",
      running: "#3b82f6",
      success: "#22c55e",
      error: "#ef4444",
      warning: "#f97316",
      skipped: "#a855f7",
      cancelled: "#6b7280",
    },
    portColors: {
      input: "#60a5fa",
      output: "#34d399",
      default: "#94a3b8",
    },
  },
  edge: {
    strokeColor: "#94a3b8",
    strokeWidth: 2,
    selectedColor: "#3b82f6",
    hoverColor: "#64748b",
    arrowSize: 8,
  },
  canvas: {
    backgroundColor: "#f1f5f9",
    gridColor: "#e2e8f0",
    gridSize: 20,
    selectionColor: "rgba(59, 130, 246, 0.2)",
  },
};

/**
 * Wrapper component with FlowEntityProvider
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FlowEntityProvider theme={defaultTheme}>{children}</FlowEntityProvider>
);

// =============================================================================
// Constants Tests
// =============================================================================

describe("HttpRequestNode Constants", () => {
  describe("HTTP_METHODS", () => {
    it("should include all standard HTTP methods", () => {
      expect(HTTP_METHODS).toContain("GET");
      expect(HTTP_METHODS).toContain("POST");
      expect(HTTP_METHODS).toContain("PUT");
      expect(HTTP_METHODS).toContain("PATCH");
      expect(HTTP_METHODS).toContain("DELETE");
      expect(HTTP_METHODS).toContain("HEAD");
      expect(HTTP_METHODS).toContain("OPTIONS");
    });

    it("should have GET as the first method", () => {
      expect(HTTP_METHODS[0]).toBe("GET");
    });
  });

  describe("DEFAULT_HTTP_METHOD", () => {
    it("should be GET", () => {
      expect(DEFAULT_HTTP_METHOD).toBe("GET");
    });
  });

  describe("CONTENT_TYPES", () => {
    it("should include common content types", () => {
      expect(CONTENT_TYPES).toContain("application/json");
      expect(CONTENT_TYPES).toContain("application/x-www-form-urlencoded");
      expect(CONTENT_TYPES).toContain("multipart/form-data");
      expect(CONTENT_TYPES).toContain("text/plain");
      expect(CONTENT_TYPES).toContain("text/xml");
    });
  });

  describe("HTTP_REQUEST_FORM_SCHEMA", () => {
    it("should have url field with required validation", () => {
      const urlField = HTTP_REQUEST_FORM_SCHEMA.properties?.url;
      expect(urlField).toBeDefined();
      expect(urlField?.type).toBe("text");
      expect(urlField?.validation?.required).toBe(true);
      expect(urlField?.validation?.pattern).toBe("^https?://");
    });

    it("should have method field with select type", () => {
      const methodField = HTTP_REQUEST_FORM_SCHEMA.properties?.method;
      expect(methodField).toBeDefined();
      expect(methodField?.type).toBe("select");
      expect(methodField?.defaultValue).toBe("GET");
      expect(methodField?.options).toHaveLength(HTTP_METHODS.length);
    });

    it("should have body field with visibility condition", () => {
      const bodyField = HTTP_REQUEST_FORM_SCHEMA.properties?.body;
      expect(bodyField).toBeDefined();
      expect(bodyField?.type).toBe("textarea");
      expect(bodyField?.visible).toEqual({
        field: "method",
        operator: "in",
        value: ["POST", "PUT", "PATCH"],
      });
    });

    it("should have timeout field with number type and validation", () => {
      const timeoutField = HTTP_REQUEST_FORM_SCHEMA.properties?.timeout;
      expect(timeoutField).toBeDefined();
      expect(timeoutField?.type).toBe("number");
      expect(timeoutField?.defaultValue).toBe(30000);
      expect(timeoutField?.validation?.min).toBe(0);
      expect(timeoutField?.validation?.max).toBe(300000);
    });

    it("should require url and method fields", () => {
      expect(HTTP_REQUEST_FORM_SCHEMA.required).toContain("url");
      expect(HTTP_REQUEST_FORM_SCHEMA.required).toContain("method");
    });
  });

  describe("HTTP_REQUEST_PORTS", () => {
    it("should have one input port", () => {
      const inputPorts = HTTP_REQUEST_PORTS.filter((p) => p.type === "input");
      expect(inputPorts).toHaveLength(1);
      expect(inputPorts[0].id).toBe("input");
    });

    it("should have two output ports (success and error)", () => {
      const outputPorts = HTTP_REQUEST_PORTS.filter((p) => p.type === "output");
      expect(outputPorts).toHaveLength(2);
      expect(outputPorts.map((p) => p.id)).toContain("output-success");
      expect(outputPorts.map((p) => p.id)).toContain("output-error");
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("createHttpRequestNode", () => {
  it("should create an entity with correct node type", () => {
    const entity = createHttpRequestNode();
    expect(entity.data?.nodeType).toBe("http-request");
  });

  it("should create an entity with correct label", () => {
    const entity = createHttpRequestNode();
    expect(entity.getLabel()).toBe("HTTP Request");
  });

  it("should create an entity with formSchema", () => {
    const entity = createHttpRequestNode();
    const schema = entity.getFormSchema();
    expect(schema).toBeDefined();
    expect(schema?.properties?.url).toBeDefined();
    expect(schema?.properties?.method).toBeDefined();
  });

  it("should create an entity with default form data", () => {
    const entity = createHttpRequestNode();
    const formData = entity.getFormData();
    expect(formData.url).toBe("");
    expect(formData.method).toBe("GET");
    expect(formData.timeout).toBe(30000);
  });

  it("should allow custom position", () => {
    const entity = createHttpRequestNode({ position: { x: 100, y: 200 } });
    const position = entity.getPosition();
    expect(position.x).toBe(100);
    expect(position.y).toBe(200);
  });

  it("should allow custom form data", () => {
    const entity = createHttpRequestNode({
      formData: {
        url: "https://api.example.com",
        method: "POST",
      },
    });
    const formData = entity.getFormData();
    expect(formData.url).toBe("https://api.example.com");
    expect(formData.method).toBe("POST");
  });

  it("should configure ports correctly", () => {
    const entity = createHttpRequestNode();
    const inputPorts = entity.getInputPorts();
    const outputPorts = entity.getOutputPorts();

    expect(inputPorts).toHaveLength(1);
    expect(outputPorts).toHaveLength(2);
  });

  it("should set appropriate size for form content", () => {
    const entity = createHttpRequestNode();
    const size = entity.getSize();
    expect(size.width).toBe(280);
    expect(size.height).toBe(320);
  });
});

// =============================================================================
// Component Rendering Tests
// =============================================================================

describe("HttpRequestNode Component", () => {
  it("should render without errors", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: /flow node/i })).toBeInTheDocument();
  });

  it("should display the node label in header", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    expect(screen.getByText("HTTP Request")).toBeInTheDocument();
  });

  it("should render form fields", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    expect(screen.getByTestId("field-input-url")).toBeInTheDocument();
    expect(screen.getByTestId("field-input-method")).toBeInTheDocument();
  });

  it("should apply custom testId", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} testId="custom-http-node" />
      </TestWrapper>
    );

    expect(screen.getByTestId("custom-http-node")).toBeInTheDocument();
  });

  it("should call onSelect when clicked", () => {
    const entity = createHttpRequestNode();
    const onSelect = vi.fn();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} onSelect={onSelect} />
      </TestWrapper>
    );

    const node = screen.getByRole("button", { name: /flow node/i });
    fireEvent.click(node);

    expect(onSelect).toHaveBeenCalledWith(entity);
  });

  it("should show selected state", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} selected={true} />
      </TestWrapper>
    );

    const node = screen.getByRole("button", { name: /flow node/i });
    expect(node).toHaveAttribute("data-selected", "true");
  });
});

// =============================================================================
// Form Interaction Tests
// =============================================================================

describe("HttpRequestNode Form Interaction", () => {
  it("should update URL field and persist to entity", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    const urlInput = screen.getByTestId("field-input-url") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://api.test.com" } });

    expect(entity.getFormData().url).toBe("https://api.test.com");
  });

  it("should update method field and persist to entity", () => {
    const entity = createHttpRequestNode();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    const methodSelect = screen.getByTestId("field-input-method") as HTMLSelectElement;
    fireEvent.change(methodSelect, { target: { value: "POST" } });

    expect(entity.getFormData().method).toBe("POST");
  });

  it("should call onFormChange when form values change", () => {
    const entity = createHttpRequestNode();
    const onFormChange = vi.fn();

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} onFormChange={onFormChange} />
      </TestWrapper>
    );

    const urlInput = screen.getByTestId("field-input-url") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "a" } });

    expect(onFormChange).toHaveBeenCalled();
    expect(onFormChange).toHaveBeenCalledWith(entity, expect.objectContaining({ url: "a" }));
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("HttpRequestNode Edge Cases", () => {
  it("should handle entity without initial config", () => {
    // Create entity manually without config
    const entity = createHttpRequestNode();
    // Clear the config
    entity.updateFormData({ url: "", method: "GET", timeout: 30000 });

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    expect(screen.getByTestId("field-input-url")).toBeInTheDocument();
  });

  it("should preserve other form values when one field changes", () => {
    const entity = createHttpRequestNode({
      formData: {
        url: "https://api.example.com",
        method: "GET",
      },
    });

    render(
      <TestWrapper>
        <HttpRequestNode entity={entity} />
      </TestWrapper>
    );

    // Change method
    const methodSelect = screen.getByTestId("field-input-method") as HTMLSelectElement;
    fireEvent.change(methodSelect, { target: { value: "POST" } });

    // URL should still be preserved
    expect(entity.getFormData().url).toBe("https://api.example.com");
    expect(entity.getFormData().method).toBe("POST");
  });
});
