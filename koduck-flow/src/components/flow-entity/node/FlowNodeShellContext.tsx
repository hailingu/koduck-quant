import { createContext, useContext } from "react";

/**
 * Metadata exposed by a parent flow-node shell.
 */
export interface FlowNodeShellContextValue {
  /** Whether the canvas shell owns node positioning and dragging. */
  managedByCanvas: boolean;
}

/**
 * Context used by node renderers to detect an outer canvas-managed shell.
 */
export const FlowNodeShellContext = createContext<FlowNodeShellContextValue | undefined>(undefined);

FlowNodeShellContext.displayName = "FlowNodeShellContext";

/**
 * Returns shell metadata when a node is rendered inside a flow-node shell.
 *
 * @returns The nearest shell metadata, or undefined when no shell is active.
 */
export function useFlowNodeShellContextOptional(): FlowNodeShellContextValue | undefined {
  return useContext(FlowNodeShellContext);
}
