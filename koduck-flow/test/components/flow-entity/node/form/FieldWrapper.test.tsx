/**
 * @file FieldWrapper Component Tests
 * @description Unit tests for the FieldWrapper component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.2
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  FieldWrapper,
  FIELD_WRAPPER_CLASS,
  FIELD_WRAPPER_COMPACT_CLASS,
  FIELD_WRAPPER_ERROR_CLASS,
  FIELD_WRAPPER_REQUIRED_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_DESCRIPTION_CLASS,
  FIELD_ERROR_CLASS,
  type FieldWrapperProps,
} from "../../../../../src/components/flow-entity/node/form/FieldWrapper";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "text",
  label: "Test Field",
  ...overrides,
});

const renderWrapper = (props: Partial<FieldWrapperProps> = {}) => {
  const defaultProps: FieldWrapperProps = {
    schema: createSchema(),
    name: "testField",
    children: <input data-testid="child-input" />,
    ...props,
  };
  return render(<FieldWrapper {...defaultProps} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("FieldWrapper", () => {
  describe("Basic Rendering", () => {
    it("should render children", () => {
      renderWrapper();
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
    });

    it("should render with base class", () => {
      renderWrapper();
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(FIELD_WRAPPER_CLASS);
    });

    it("should set data-field-name attribute", () => {
      renderWrapper({ name: "myField" });
      const wrapper = screen.getByTestId("field-wrapper-myField");
      expect(wrapper).toHaveAttribute("data-field-name", "myField");
    });

    it("should use custom testId", () => {
      renderWrapper({ testId: "custom-wrapper" });
      expect(screen.getByTestId("custom-wrapper")).toBeInTheDocument();
    });
  });

  describe("Label Rendering", () => {
    it("should render label from schema", () => {
      renderWrapper({
        schema: createSchema({ label: "My Label" }),
      });
      expect(screen.getByTestId("field-label-testField")).toHaveTextContent("My Label");
    });

    it("should render label from ui:title", () => {
      renderWrapper({
        schema: createSchema({ "ui:title": "UI Title", label: "Label" }),
      });
      expect(screen.getByTestId("field-label-testField")).toHaveTextContent("UI Title");
    });

    it("should render label with required indicator", () => {
      renderWrapper({
        schema: createSchema({ validation: { required: true } }),
      });
      const label = screen.getByTestId("field-label-testField");
      expect(label).toHaveTextContent("*");
    });

    it("should hide label when hideLabel is true", () => {
      renderWrapper({ hideLabel: true });
      expect(screen.queryByTestId("field-label-testField")).not.toBeInTheDocument();
    });

    it("should generate label from field name if not provided", () => {
      renderWrapper({
        schema: { type: "text" },
        name: "firstName",
      });
      expect(screen.getByTestId("field-label-firstName")).toHaveTextContent("First Name");
    });
  });

  describe("Description Rendering", () => {
    it("should render description from schema", () => {
      renderWrapper({
        schema: createSchema({ description: "Help text here" }),
      });
      expect(screen.getByTestId("field-description-testField")).toHaveTextContent("Help text here");
    });

    it("should render description from ui:description", () => {
      renderWrapper({
        schema: createSchema({
          "ui:description": "UI Description",
          description: "Regular description",
        }),
      });
      expect(screen.getByTestId("field-description-testField")).toHaveTextContent("UI Description");
    });

    it("should not render description in compact mode", () => {
      renderWrapper({
        schema: createSchema({ description: "Help text" }),
        compact: true,
      });
      expect(screen.queryByTestId("field-description-testField")).not.toBeInTheDocument();
    });

    it("should not render description if not provided", () => {
      renderWrapper({
        schema: createSchema({ description: undefined }),
      });
      expect(screen.queryByTestId("field-description-testField")).not.toBeInTheDocument();
    });
  });

  describe("Error Rendering", () => {
    it("should render error message", () => {
      renderWrapper({ error: "This field is required" });
      const errorEl = screen.getByTestId("field-error-testField");
      expect(errorEl).toHaveTextContent("This field is required");
      expect(errorEl).toHaveAttribute("role", "alert");
    });

    it("should apply error class when error exists", () => {
      renderWrapper({ error: "Error message" });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(FIELD_WRAPPER_ERROR_CLASS);
    });

    it("should not render error element when no error", () => {
      renderWrapper({ error: undefined });
      expect(screen.queryByTestId("field-error-testField")).not.toBeInTheDocument();
    });
  });

  describe("Compact Mode", () => {
    it("should apply compact class", () => {
      renderWrapper({ compact: true });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(FIELD_WRAPPER_COMPACT_CLASS);
    });

    it("should hide description in compact mode", () => {
      renderWrapper({
        schema: createSchema({ description: "Description" }),
        compact: true,
      });
      expect(screen.queryByTestId("field-description-testField")).not.toBeInTheDocument();
    });
  });

  describe("Required Field", () => {
    it("should apply required class", () => {
      renderWrapper({
        schema: createSchema({ validation: { required: true } }),
      });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(FIELD_WRAPPER_REQUIRED_CLASS);
    });

    it("should show required indicator in label", () => {
      renderWrapper({
        schema: createSchema({ validation: { required: true } }),
      });
      const indicator = screen.getByText("*");
      expect(indicator).toHaveClass(`${FIELD_LABEL_CLASS}--required`);
    });
  });

  describe("Label Position", () => {
    it("should apply top label position class by default", () => {
      renderWrapper();
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(`${FIELD_WRAPPER_CLASS}--top`);
    });

    it("should apply left label position class", () => {
      renderWrapper({ labelPosition: "left" });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(`${FIELD_WRAPPER_CLASS}--left`);
    });

    it("should apply inline label position class", () => {
      renderWrapper({ labelPosition: "inline" });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(`${FIELD_WRAPPER_CLASS}--inline`);
    });
  });

  describe("Hidden Fields", () => {
    it("should render children without wrapper for hidden fields", () => {
      const { container } = renderWrapper({
        schema: createSchema({ hidden: true }),
      });
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
      expect(screen.queryByTestId("field-wrapper-testField")).not.toBeInTheDocument();
    });

    it("should render children without wrapper for hidden widget", () => {
      renderWrapper({
        schema: createSchema({ "ui:widget": "hidden" }),
      });
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
      expect(screen.queryByTestId("field-wrapper-testField")).not.toBeInTheDocument();
    });
  });

  describe("Custom Class Names", () => {
    it("should apply custom className", () => {
      renderWrapper({ className: "my-custom-class" });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass("my-custom-class");
    });

    it("should combine multiple classes", () => {
      renderWrapper({
        className: "custom-class",
        compact: true,
        error: "Error",
      });
      const wrapper = screen.getByTestId("field-wrapper-testField");
      expect(wrapper).toHaveClass(FIELD_WRAPPER_CLASS);
      expect(wrapper).toHaveClass(FIELD_WRAPPER_COMPACT_CLASS);
      expect(wrapper).toHaveClass(FIELD_WRAPPER_ERROR_CLASS);
      expect(wrapper).toHaveClass("custom-class");
    });
  });

  describe("Accessibility", () => {
    it("should associate label with input via htmlFor", () => {
      renderWrapper({ name: "email" });
      const label = screen.getByTestId("field-label-email");
      expect(label).toHaveAttribute("for", "field-email");
    });

    it("should have role=alert on error message", () => {
      renderWrapper({ error: "Error" });
      const errorEl = screen.getByTestId("field-error-testField");
      expect(errorEl).toHaveAttribute("role", "alert");
    });

    it("should have aria-hidden on required indicator", () => {
      renderWrapper({
        schema: createSchema({ validation: { required: true } }),
      });
      const indicator = screen.getByText("*");
      expect(indicator).toHaveAttribute("aria-hidden", "true");
    });
  });
});
