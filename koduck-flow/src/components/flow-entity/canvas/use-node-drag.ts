import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
 * @returns Pointer down handler for the node container.
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

  const handlePressStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
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
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        pointerStart: { x: event.clientX, y: event.clientY },
        nodeStart: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        scale: (viewportScale || 1) * (interactionScale || 1),
        dragging: true,
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag?.dragging) {
          return;
        }

        onNodeMove(node.id, {
          x: drag.nodeStart.x + (moveEvent.clientX - drag.pointerStart.x) / drag.scale,
          y: drag.nodeStart.y + (moveEvent.clientY - drag.pointerStart.y) / drag.scale,
        });
      };

      const handlePointerUp = () => {
        dragRef.current = null;
        globalThis.removeEventListener("pointermove", handlePointerMove);
        globalThis.removeEventListener("pointerup", handlePointerUp);
        globalThis.removeEventListener("pointercancel", handlePointerUp);
      };

      globalThis.addEventListener("pointermove", handlePointerMove);
      globalThis.addEventListener("pointerup", handlePointerUp);
      globalThis.addEventListener("pointercancel", handlePointerUp);
    },
    [dragNodes, interactionScale, node, onNodeMove, onNodeSelect, selectNodes, viewportScale]
  );

  return handlePressStart;
}
