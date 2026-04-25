import React, { forwardRef, useEffect, useRef, useCallback } from "react";

type CanvasMouseHandler = React.MouseEventHandler<HTMLCanvasElement> | undefined;

interface CanvasElementProps {
  style?: React.CSSProperties;
  className?: string;
  onMouseDown?: CanvasMouseHandler;
  onMouseMove?: CanvasMouseHandler;
  onMouseUp?: CanvasMouseHandler;
  onMouseLeave?: CanvasMouseHandler;
  onClick?: CanvasMouseHandler;
}

export const CanvasElement = forwardRef<HTMLCanvasElement, CanvasElementProps>(
  ({ style, className, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onClick }, ref) => {
    const internalRef = useRef<HTMLCanvasElement | null>(null);

    // 合并 ref
    const setRefs = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        internalRef.current = canvas;
        if (typeof ref === "function") {
          ref(canvas);
        } else if (ref) {
          ref.current = canvas;
        }
      },
      [ref]
    );

    // 初始化 canvas 尺寸
    useEffect(() => {
      const canvas = internalRef.current;
      if (!canvas) return;

      const updateCanvasSize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // 只有当尺寸有效时才更新
        if (rect.width > 0 && rect.height > 0) {
          const newWidth = Math.floor(rect.width * dpr);
          const newHeight = Math.floor(rect.height * dpr);

          // 避免不必要的重绘
          if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
          }
        }
      };

      // 初始化尺寸
      updateCanvasSize();

      // 监听窗口大小变化
      const resizeObserver = new ResizeObserver(() => {
        updateCanvasSize();
      });
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    return (
      <canvas
        ref={setRefs}
        className={className}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={style}
        data-testid="flow-canvas"
      />
    );
  }
);

CanvasElement.displayName = "CanvasElement";

export default CanvasElement;
