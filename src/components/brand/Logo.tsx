/**
 * Docket logo, rebuilt as SVG from the brand reference (public/brand-reference.png).
 * Mark: teal "D" with a cream house cut-out and a terracotta door. Wordmark: "docket" in Archivo ExtraBold, ink.
 * Colours come from CSS tokens so the mark always matches the theme — see .claude/skills/docket-brand/SKILL.md.
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
      <path d="M0 0H40A45 46 0 0 1 40 92H0Z" fill="var(--teal)" />
      <path d="M38.5 27L59 47.5V70H18V47.5Z" fill="var(--cream)" />
      <rect x="34" y="56" width="9.5" height="14" fill="var(--terracotta)" />
    </svg>
  );
}

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`} style={{ gap: size * 0.45 }}>
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
