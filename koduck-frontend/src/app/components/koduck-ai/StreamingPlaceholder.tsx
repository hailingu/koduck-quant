export function StreamingPlaceholder() {
  return (
    <div className="inline-flex items-center gap-2 text-base text-gray-500">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
    </div>
  );
}
