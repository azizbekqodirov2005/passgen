/**
 * Brand marks, drawn as SVG so they stay crisp in both themes and need no
 * image assets.
 *
 * `PassGenMark` is the product mark: a shield with a keyhole.
 * `AzbekDevLogo` is the maker's mark used in the footer — a monogram "A" built
 * from two code brackets, plus the wordmark. Replace the monogram paths with
 * your own exported SVG if you later want the exact logo file.
 */

export function PassGenMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="10" fill="var(--accent-soft)" />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        stroke="var(--accent)"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <path
        d="M20 9.5l8.5 3.9v7.1c0 5.3-3.5 9.8-8.5 11.2-5-1.4-8.5-5.9-8.5-11.2v-7.1z"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="18.6" r="2.9" stroke="var(--accent)" strokeWidth="1.8" />
      <path
        d="M20 21.5v4.2"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The maker's mark. `variant="full"` renders monogram + wordmark,
 * `variant="mark"` renders just the monogram.
 */
export function AzbekDevLogo({
  size = 26,
  variant = 'full',
}: {
  size?: number;
  variant?: 'full' | 'mark';
}) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.08" />
      <rect
        x="0.6"
        y="0.6"
        width="30.8"
        height="30.8"
        rx="7.4"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.2"
      />
      {/* Monogram A made of two brackets meeting at the apex. */}
      <path
        d="M16 7.6l5.8 16.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 7.6l-5.8 16.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.4 18.6h7.2"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === 'mark') return mark;

  return (
    <span className="u-row" style={{ gap: 'var(--space-2)' }}>
      {mark}
      <span
        style={{
          fontWeight: 650,
          fontSize: 'var(--text-sm)',
          letterSpacing: 'var(--tracking-tighter)',
        }}
      >
        Azbek<span style={{ color: 'var(--accent)' }}>Dev</span>
      </span>
    </span>
  );
}
