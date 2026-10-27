import React from "react";

type P = { size?: number; color: string };

const wrap = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS: Record<string, (c: string) => React.ReactNode> = {
  user: (c) => (
    <g stroke={c}>
      <circle cx="24" cy="16" r="8" />
      <path d="M8 42c2-9 9-13 16-13s14 4 16 13" />
    </g>
  ),
  laptop: (c) => (
    <g stroke={c}>
      <rect x="9" y="10" width="30" height="20" rx="2" />
      <path d="M4 38h40l-4-8H8z" />
    </g>
  ),
  server: (c) => (
    <g stroke={c}>
      <rect x="8" y="6" width="32" height="14" rx="3" />
      <rect x="8" y="28" width="32" height="14" rx="3" />
      <circle cx="15" cy="13" r="1.5" fill={c} />
      <circle cx="15" cy="35" r="1.5" fill={c} />
    </g>
  ),
  database: (c) => (
    <g stroke={c}>
      <ellipse cx="24" cy="11" rx="15" ry="5" />
      <path d="M9 11v26c0 3 7 5 15 5s15-2 15-5V11" />
      <path d="M9 24c0 3 7 5 15 5s15-2 15-5" />
    </g>
  ),
  api: (c) => (
    <g stroke={c}>
      <path d="M16 14l-9 10 9 10M32 14l9 10-9 10M27 10l-6 28" />
    </g>
  ),
  shield: (c) => (
    <g stroke={c}>
      <path d="M24 5l15 6v11c0 10-7 18-15 21C16 40 9 32 9 22V11z" />
      <path d="M17 24l5 5 9-10" />
    </g>
  ),
  lock: (c) => (
    <g stroke={c}>
      <rect x="10" y="21" width="28" height="20" rx="3" />
      <path d="M16 21v-6a8 8 0 0116 0v6" />
    </g>
  ),
  cloud: (c) => (
    <g stroke={c}>
      <path d="M14 36h21a8 8 0 000-16 11 11 0 00-21-2 9 9 0 000 18z" />
    </g>
  ),
  bolt: (c) => (
    <g stroke={c}>
      <path d="M27 4L10 27h13l-3 17 18-24H25z" />
    </g>
  ),
  check: (c) => (
    <g stroke={c}>
      <circle cx="24" cy="24" r="18" />
      <path d="M15 24l6 6 12-13" />
    </g>
  ),
  cross: (c) => (
    <g stroke={c}>
      <circle cx="24" cy="24" r="18" />
      <path d="M17 17l14 14M31 17L17 31" />
    </g>
  ),
  clock: (c) => (
    <g stroke={c}>
      <circle cx="24" cy="24" r="18" />
      <path d="M24 13v12l8 5" />
    </g>
  ),
  code: (c) => (
    <g stroke={c}>
      <rect x="5" y="8" width="38" height="32" rx="4" />
      <path d="M18 19l-6 5 6 5M30 19l6 5-6 5" />
    </g>
  ),
  globe: (c) => (
    <g stroke={c}>
      <circle cx="24" cy="24" r="18" />
      <path d="M6 24h36M24 6c6 6 6 30 0 36M24 6c-6 6-6 30 0 36" />
    </g>
  ),
  robot: (c) => (
    <g stroke={c}>
      <rect x="9" y="15" width="30" height="24" rx="5" />
      <path d="M24 15V8M19 26h0M29 26h0M18 33h12" />
      <circle cx="24" cy="7" r="2" />
    </g>
  ),
};

export const ICON_NAMES = Object.keys(ICONS);

export const Icon: React.FC<P & { name?: string }> = ({ name, size = 64, color }) =>
  wrap(size, (ICONS[name ?? ""] ?? ICONS.bolt)(color));
