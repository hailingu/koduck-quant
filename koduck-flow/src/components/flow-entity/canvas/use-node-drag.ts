import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { IFlowNodeEntityData, Position } from "../types";

interface UseNodeDragOptions {
  node: IFlowNodeEntityData;
  selectNodes: boolean;
  dragNodes: boolean;
  viewportScale: number;
  interactionScale: number;
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeMove?: (nodeId: string, position: Position) => void;
}

interface NodeDragState {
  pointerStart: Position;
  nodeStart: Position;
  scale: number;
  dragging: boolean;
}

/**
 * Manage pointer-driven node selection and dragging.
 *
 * @param root0 - Hook options.
 * @param root0.node - Node being rendered.
 * @param root0.selectNodes - Whether mouse down should select the node.
 * @param root0.dragNodes - Whether mouse drag should move the node.
 * @param root0.viewportScale - Current viewport zoom scale.
 * @param root0.interactionScale - Additional scale applied outside the canvas.
 * @param root0.onNodeSelect - Optional node selection callback.
 * @param root0.onNodeMove - Optional node movement callback.
 * @returns Mouse down handler for the node container.
 */
export function useNodeDrag({
  node,
  selectNodes,
  dragNodes,
  viewportScale,
  interactionScale,
  onNodeSelect,
  onNodeMove,
}: UseNodeDragOptions) {
  const dragRef = useRef<NodeDragState | null>(null);

  return useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();
      if (selectNodes) {
        onNodeSelect?.([node.id]);
      }

      if (!dragNodes || !onNodeMove) {
        return;
      }

      event.preventDefault();
      dragRef.current = {
        pointerStart: { x: event.clientX, y: event.clientY },
        nodeStart: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        scale: (viewportScale || 1) * (interactionScale || 1),
        dragging: true,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag?.dragging) {
          return;
        }

        onNodeMove(node.id, {
          x: drag.nodeStart.x + (moveEvent.clientX - drag.pointerStart.x) / drag.scale,
          y: drag.nodeStart.y + (moveEvent.clientY - drag.pointerStart.y) / drag.scale,
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        globalThis.removeEventListener("mousemove", handleMouseMove);
        globalThis.removeEventListener("mouseup", handleMouseUp);
      };

      globalThis.addEventListener("mousemove", handleMouseMove);
      globalThis.addEventListener("mouseup", handleMouseUp);
    },
    [dragNodes, interactionScale, node, onNodeMove, onNodeSelect, selectNodes, viewportScale]
  );
}
