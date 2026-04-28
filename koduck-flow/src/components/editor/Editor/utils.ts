export const getCursorStyle = (opts: {
  disabled?: boolean;
  isDragging?: boolean;
  isDraggingMultiple?: boolean;
  isSelecting?: boolean;
}): string => {
  const { disabled, isDragging, isDraggingMultiple, isSelecting } = opts;
  if (disabled) return "not-allowed";
  if (isDragging || isDraggingMultiple) return "grabbing";
  if (isSelecting) return "crosshair";
  return "grab";
};
