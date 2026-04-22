import type { SVGProps } from "react";

import { cn } from "./ui/utils";

type KoduckQuantLogoProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function KoduckQuantLogo({
  className,
  title = "Koduck Quant",
  ...props
}: KoduckQuantLogoProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn(
        "h-14 w-14 drop-shadow-[0_14px_28px_rgba(45,212,191,0.14)]",
        className,
      )}
      {...props}
    >
      <defs>
        <linearGradient id="koduck-line" x1="22" y1="60" x2="82" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="0.55" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
        <linearGradient id="koduck-head" x1="60" y1="18" x2="80" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#134E4A" />
        </linearGradient>
        <linearGradient id="koduck-beak" x1="69" y1="38" x2="83" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#FDE68A" />
        </linearGradient>
        <radialGradient id="koduck-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(49 44) rotate(135) scale(34 30)">
          <stop stopColor="#5EEAD4" stopOpacity="0.18" />
          <stop offset="1" stopColor="#5EEAD4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="48" cy="48" r="28" fill="url(#koduck-glow)" />
      <path d="M24 30H42" stroke="#CBD5E1" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 42H36" stroke="#E2E8F0" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 72H72" stroke="#E2E8F0" strokeOpacity="0.95" strokeWidth="1.5" strokeLinecap="round" />

      <path d="M27 64V72" stroke="#34D399" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="23.5" y="56" width="7" height="12" rx="3.5" fill="#34D399" />
      <path d="M39 54V71" stroke="#5EEAD4" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="35.5" y="48" width="7" height="14" rx="3.5" fill="#67E8F9" fillOpacity="0.9" />
      <path d="M51 44V64" stroke="#FBBF24" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="47.5" y="40" width="7" height="12" rx="3.5" fill="#FBBF24" />

      <path
        d="M23 64C30 58 35 53 40 50C45 47 48 46 53 41C58 36 62 28 72 28"
        stroke="url(#koduck-line)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M63 30.5C63 22.49 69.49 16 77.5 16C84.94 16 91 22.06 91 29.5C91 37.51 84.51 44 76.5 44H68.5C65.46 44 63 41.54 63 38.5V30.5Z"
        fill="url(#koduck-head)"
      />
      <path
        d="M70.4 39.6C72.7 39.6 74.7 38.82 76.48 37.24C77.2 36.6 78.27 36.65 78.95 37.33L80.84 39.22C81.72 40.1 81.41 41.61 80.25 42.03C78.73 42.59 77.1 42.89 75.4 42.89H70.62C69.54 42.89 68.97 41.6 69.69 40.8L70.4 39.6Z"
        fill="#ECFEFF"
        fillOpacity="0.95"
      />
      <path
        d="M74 31C74 27.13 77.13 24 81 24H84.32C85.42 24 86.47 24.47 87.2 25.3L89.37 27.74C90.21 28.69 90.21 30.11 89.37 31.06L87.2 33.5C86.47 34.33 85.42 34.8 84.32 34.8H81C77.13 34.8 74 31.67 74 27.8V31Z"
        fill="url(#koduck-beak)"
      />
      <circle cx="76.65" cy="25.95" r="3.1" fill="#F8FAFC" />
      <circle cx="77.2" cy="26.1" r="1.4" fill="#0F172A" />
      <path
        d="M60 60C63.6 54.67 69.44 51.5 75.88 51.5C78.88 51.5 81.78 52.19 84.4 53.46"
        stroke="#0F172A"
        strokeOpacity="0.14"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
