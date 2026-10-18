/**
 * Docket logo as SVG. Shape traced from the original brand mark (public/brand-reference.png):
 * a "D" with a house cut-out and a door. Greyscale: near-black D, white house, grey door.
 * Wordmark: "docket" in Archivo ExtraBold, ink. Colours come from CSS tokens; see the docket-brand skill.
 */

/** viewBox matches the traced proportions of the original mark (85 × 92). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 85 92"
      width={(size * 85) / 92}
      height={size}
      className={className}
      role="img"
      aria-label="Docket"
    >
      <path d="M0 0H40A45 46 0 0 1 40 92H0Z" fill="var(--primary)" />
      <path d="M38.5 27L59 47.5V70H18V47.5Z" fill="var(--white)" />
      <rect x="34" y="56" width="9.5" height="14" fill="var(--logo-door)" />
    </svg>
  );
}

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    // dir="ltr": the logo keeps its D-then-wordmark order in right-to-left languages.
    <span dir="ltr" className={`inline-flex items-center ${className ?? ""}`} style={{ gap: size * 0.45 }}>
      <LogoMark size={size} />
      <span
        className="font-display font-extrabold leading-none tracking-tight text-ink"
        style={{ fontSize: size * 1.05 }}
      >
        docket
      </span>
    </span>
  );
}
