import type { ReactElement } from "react";

type Glyph = {
  readonly viewBox: string;
  readonly filled?: true;
  readonly body: ReactElement;
};

/** Stroke-based, 20/24px grid, one consistent weight — matching popup/popup.css. */
const GLYPHS = {
  download: {
    viewBox: "0 0 20 20",
    body: <path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 15.5h12" />,
  },
  route: {
    viewBox: "0 0 20 20",
    filled: true,
    body: <path d="M3.5 6.5h5v-3l4 4-4 4v-3h-5v-2Zm13 7h-5v3l-4-4 4-4v3h5v2Z" />,
  },
  stop: {
    viewBox: "0 0 20 20",
    filled: true,
    body: <rect x="5" y="5" width="10" height="10" rx="2" />,
  },
  arrowDown: {
    viewBox: "0 0 20 20",
    body: <path d="M10 4v12m0 0-4.5-4.5M10 16l4.5-4.5" />,
  },
  arrowRight: {
    viewBox: "0 0 24 24",
    body: <path d="M5 12h13m0 0-4-4m4 4-4 4" />,
  },
  chevronRight: {
    viewBox: "0 0 20 20",
    body: <path d="m7.5 5 5 5-5 5" />,
  },
  chevronLeft: {
    viewBox: "0 0 20 20",
    body: <path d="m12 5-5 5 5 5" />,
  },
  check: {
    viewBox: "0 0 20 20",
    body: <path d="m5 10.5 3 3 7-7.5" />,
  },
  shieldSmall: {
    viewBox: "0 0 20 20",
    body: (
      <>
        <path d="M10 2.5 16 5v4.5c0 3.7-2.5 6.5-6 8-3.5-1.5-6-4.3-6-8V5l6-2.5Z" />
        <path d="m7.2 10 1.8 1.8 3.8-4" />
      </>
    ),
  },
  shield: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M12 3 19 6v5.4c0 4.4-3 7.8-7 9.6-4-1.8-7-5.2-7-9.6V6l7-3Z" />
        <path d="m8.7 12 2.2 2.2 4.4-4.8" />
      </>
    ),
  },
  serverSlash: {
    viewBox: "0 0 20 20",
    body: (
      <>
        <rect x="3" y="4" width="14" height="5" rx="1.5" />
        <rect x="3" y="11" width="14" height="5" rx="1.5" />
        <path d="M4 3 16 17" />
      </>
    ),
  },
  circleSlash: {
    viewBox: "0 0 20 20",
    body: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m5 15 10-10" />
      </>
    ),
  },
  refresh: {
    viewBox: "0 0 20 20",
    body: (
      <>
        <path d="M3.5 10a6.5 6.5 0 0 1 11.8-3.8M16.5 10A6.5 6.5 0 0 1 4.7 13.8" />
        <path d="m14.8 3 .5 3.2-3.2.5M5.2 17l-.5-3.2 3.2-.5" />
      </>
    ),
  },
  tab: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <rect x="3" y="4" width="18" height="15" rx="3" />
        <path d="M3 8h18" />
      </>
    ),
  },
  tabSplit: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <rect x="3" y="4" width="18" height="15" rx="3" />
        <path d="M3 8h18M12 12v3" />
      </>
    ),
  },
  speaker: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M4 9.25v5.5h3.7l4.8 3.75v-13L7.7 9.25H4Z" />
        <path d="M16 8.4a4.8 4.8 0 0 1 0 7.2M18.6 5.8a8.25 8.25 0 0 1 0 12.4" />
      </>
    ),
  },
  target: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4" />
        <circle cx="12" cy="12" r="3.2" />
      </>
    ),
  },
  swap: {
    viewBox: "0 0 24 24",
    body: <path d="M4 8h10l-3-3M20 16H10l3 3" />,
  },
  window: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M8 19v2h8v-2" />
      </>
    ),
  },
  fullscreen: {
    viewBox: "0 0 24 24",
    body: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  },
  microphone: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <rect x="9" y="3" width="6" height="10" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </>
    ),
  },
  info: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16v.1" />
      </>
    ),
  },
  menu: {
    viewBox: "0 0 24 24",
    body: <path d="M4 7h16M4 12h16M4 17h16" />,
  },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;

type Props = {
  readonly name: IconName;
  readonly className?: string;
};

export function Icon({ name, className = "size-6" }: Props) {
  const glyph: Glyph = GLYPHS[name];
  return (
    <svg
      viewBox={glyph.viewBox}
      className={className}
      aria-hidden="true"
      {...(glyph.filled
        ? { fill: "currentColor" }
        : {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.55,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
          })}
    >
      {glyph.body}
    </svg>
  );
}
