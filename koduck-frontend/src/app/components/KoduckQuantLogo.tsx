import type { ImgHTMLAttributes } from "react";

import { cn } from "./ui/utils";

type KoduckQuantLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  title?: string;
};

export function KoduckQuantLogo({
  className,
  title = "Koduck Quant",
  ...props
}: KoduckQuantLogoProps) {
  return (
    <img
      src="/koduck-ai-logo-transparent.png"
      alt={title}
      className={cn(
        "h-auto w-24 object-contain drop-shadow-[0_16px_32px_rgba(15,23,42,0.12)]",
        className,
      )}
      {...props}
    />
  );
}
