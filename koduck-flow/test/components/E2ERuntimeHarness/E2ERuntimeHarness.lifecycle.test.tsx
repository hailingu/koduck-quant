import React from "react";
import { describe, it, afterEach, expect, vi } from "vitest";
import { render, screen, within, act, cleanup, fireEvent } from "@testing-library/react";

import { E2ERuntimeHarness } from "../../../src/components/E2ERuntimeHarness";

describe("E2ERuntimeHarness", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("supports renderer switching and entity lifecycle management", () => {
    render(<E2ERuntimeHarness />);

    expect(screen.getByTestId("runtime-ready")).toBeInTheDocument();
    expect(screen.getByTestId("renderer-active-react")).toHaveTextContent("Active: react");

    fireEvent.click(screen.getByTestId("renderer-canvas"));
    expect(screen.getByTestId("renderer-active-canvas")).toHaveTextContent("Active: canvas");

    const entityTypeInput = screen.getByPlaceholderText("Entity type") as HTMLInputElement;
    const entityIdInput = screen.getByPlaceholderText("Entity ID") as HTMLInputElement;
    const entityNameInput = screen.getByPlaceholderText("Entity name") as HTMLInputElement;

    fireEvent.change(entityTypeInput, { target: { value: "  workflow  " } });
    fireEvent.change(entityIdInput, { target: { value: "  entity-1  " } });
    fireEvent.change(entityNameInput, { target: { value: " First Entity " } });
    fireEvent.click(screen.getByTestId("confirm-create"));

    const entityCard = screen.getByTestId("entity-entity-1");
    expect(within(entityCard).getByTestId("entity-name")).toHaveTextContent("First Entity");
    expect(entityCard).toHaveAttribute("data-renderer", "canvas");
    expect(entityCard).toHaveTextContent("workflow");

    fireEvent.change(entityTypeInput, { target: { value: " service " } });
    fireEvent.change(entityIdInput, { target: { value: "entity-1" } });
    fireEvent.change(entityNameInput, { target: { value: "Second Entity" } });
    fireEvent.click(screen.getByTestId("confirm-create"));

    const updatedCard = screen.getByTestId("entity-entity-1");
    expect(within(updatedCard).getByTestId("entity-name")).toHaveTextContent("Second Entity");
    expect(updatedCard).toHaveTextContent("service");

    fireEvent.click(screen.getByTestId("edit-entity-entity-1"));
    const editInput = screen.getByTestId("entity-name-input") as HTMLInputElement;
    fireEvent.change(editInput, { target: { value: "QA Harness Entity" } });
    fireEvent.click(screen.getByTestId("save-entity"));
    expect(within(updatedCard).getByTestId("entity-name")).toHaveTextContent("QA Harness Entity");

    fireEvent.click(screen.getByTestId("delete-entity-entity-1"));
    fireEvent.click(screen.getByTestId("confirm-delete"));
    expect(screen.queryByTestId("entity-entity-1")).not.toBeInTheDocument();
  });

  it("builds and executes flows with nodes and connections", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-01T00:00:00Z"));

    render(<E2ERuntimeHarness />);

    const timestampBase = Date.now();

    fireEvent.click(screen.getByTestId("create-flow-btn"));
    fireEvent.change(screen.getByTestId("flow-id"), { target: { value: " flow-1 " } });
    fireEvent.change(screen.getByTestId("flow-name"), { target: { value: " Flow Alpha " } });

    fireEvent.click(screen.getByTestId("confirm-connection"));

    fireEvent.click(screen.getByTestId("add-node-btn"));
    fireEvent.change(screen.getByTestId("node-id"), { target: { value: " start " } });
    fireEvent.change(screen.getByTestId("node-type"), { target: { value: "start" } });
    fireEvent.change(screen.getByTestId("node-x"), { target: { value: "10" } });
    fireEvent.change(screen.getByTestId("node-y"), { target: { value: "20" } });
    fireEvent.click(screen.getByTestId("confirm-node"));

    fireEvent.click(screen.getByTestId("add-node-btn"));
    fireEvent.change(screen.getByTestId("node-id"), { target: { value: " end " } });
    fireEvent.change(screen.getByTestId("node-type"), { target: { value: "end" } });
    fireEvent.change(screen.getByTestId("node-x"), { target: { value: "30" } });
    fireEvent.change(screen.getByTestId("node-y"), { target: { value: "40" } });
    fireEvent.click(screen.getByTestId("confirm-node"));

    fireEvent.change(screen.getByTestId("connection-condition"), {
      target: { value: "success-path" },
    });
    fireEvent.click(screen.getByTestId("node-start"));
    fireEvent.click(screen.getByTestId("node-end"));
    fireEvent.click(screen.getByTestId("confirm-connection"));

    fireEvent.click(screen.getByTestId("save-flow"));

    expect((screen.getByTestId("flow-id") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("connection-condition") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByTestId("node-start")).not.toBeInTheDocument();

    expect(screen.getByText("Flow Alpha")).toBeInTheDocument();
    expect(screen.getByText(/2 nodes/i)).toBeInTheDocument();

    const executeButton = screen.getByTestId("execute-flow-flow-1");
    fireEvent.click(executeButton);

    expect(screen.getByText("Executing...")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText("Executing...")).not.toBeInTheDocument();
    expect(screen.getByTestId("execution-complete")).toBeInTheDocument();

    const payloadText = screen.getByTestId("execution-result").textContent ?? "{}";
    const payload = JSON.parse(payloadText);
    expect(payload).toMatchObject({
      flowId: "flow-1",
      status: "completed",
      nodesExecuted: 2,
    });
    expect(payload.timestamp).toBe(timestampBase + 300);
  });
});
