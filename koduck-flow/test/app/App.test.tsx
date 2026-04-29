import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("../../src/components/demo/FlowDemo", () => ({
  FlowDemo: () => <div data-testid="flow-demo">flow-demo</div>,
}));

vi.mock("../../src/components/testing/E2ERuntimeHarness", () => ({
  E2ERuntimeHarness: () => <div data-testid="runtime-harness">runtime-harness</div>,
}));

import App from "../../src/App";

describe("App", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("presents the playground without the E2E harness by default", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: /duck flow playground/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /interactive flow demo/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId("flow-demo")).toBeInTheDocument();
    expect(screen.queryByTestId("runtime-harness")).not.toBeInTheDocument();
  });

  it("mounts the E2E harness when explicitly requested", () => {
    window.history.replaceState({}, "", "/?e2e=1");

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 2, name: /e2e runtime harness/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("runtime-harness")).toBeInTheDocument();
  });
});
