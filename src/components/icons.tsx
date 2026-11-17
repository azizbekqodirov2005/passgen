/**
 * A small hand-built icon set. Every glyph is drawn on the same 24-unit grid
 * with a 1.6 stroke and round joins, so the whole interface stays consistent
 * without pulling in an icon dependency.
 */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({
  size = 18,
  className,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
  </Svg>
);

export const IconVault = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 4v2M12 18v2" />
  </Svg>
);

export const IconStar = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 4.2l2.35 4.9 5.15.7-3.75 3.6.93 5.4L12 16.2l-4.68 2.6.93-5.4L4.5 9.8l5.15-.7z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
);

export const IconKey = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="3.4" />
    <path d="M11.4 12H21M18 12v3M15 12v2.4" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l7 2.8v5.3c0 4.2-2.8 7.8-7 9-4.2-1.2-7-4.8-7-9V6.3z" />
    <path d="M9.2 12.1l2 2 3.6-3.9" />
  </Svg>
);

export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.2V5a1 1 0 011-1h6.2a1 1 0 01.7.3l7.8 7.8a1 1 0 010 1.4l-6.2 6.2a1 1 0 01-1.4 0L4.3 11.9a1 1 0 01-.3-.7z" />
    <circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3v2.2M12 18.8V21M4.8 7.8l1.9 1.1M17.3 15.1l1.9 1.1M4.8 16.2l1.9-1.1M17.3 8.9l1.9-1.1" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="M15.6 15.6L20 20" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5.5A1.5 1.5 0 0013.5 4H5.5A1.5 1.5 0 004 5.5v8A1.5 1.5 0 005.5 15" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.6 9.7a2.6 2.6 0 003.7 3.7" />
    <path d="M6.4 6.6C4.1 8.2 2.5 12 2.5 12s3.5 5.8 9.5 5.8c1.4 0 2.6-.3 3.7-.8M17.3 15c2-1.5 4.2-3 4.2-3S18 6.2 12 6.2c-.5 0-1 0-1.4.1" />
  </Svg>
);

export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19.5 8.5a2 2 0 000-2.8l-1.2-1.2a2 2 0 00-2.8 0L4 16z" />
    <path d="M14.5 6.5l3 3" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V5h5v2M6 7l1 13h10l1-13" />
    <path d="M10.5 11v5M13.5 11v5" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.2 10.5V8a3.8 3.8 0 017.6 0v2.5" />
    <path d="M12 14v2.5" />
  </Svg>
);

export const IconUnlock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.2 10.5V8a3.8 3.8 0 017.3-1.3" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10M8 10.5l4 4 4-4M5 19h14" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V6M8 9.5l4-4 4 4M5 19h14" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 10-2.9 6.2" />
    <path d="M20 5v5h-5" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 5h5v5M19 5l-7.5 7.5" />
    <path d="M18 14v4a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 18V7.5A1.5 1.5 0 016.5 6h4" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5l8.3 14.4H3.7z" />
    <path d="M12 10v4M12 16.6v.4" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c.9-3.4 3.6-5.2 7-5.2s6.1 1.8 7 5.2" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconSort = (p: IconProps) => (
  <Svg {...p} size={12}>
    <path d="M12 5v14M7 15l5 5 5-5" />
  </Svg>
);
