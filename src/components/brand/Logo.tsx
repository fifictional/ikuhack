/*
 * Docket logo as SVG. Shape traced from the original brand mark (public/brand-reference.png):
 * a "D" with a house cut-out and a door. Greyscale: near-black D, white house, grey door.
 * Wordmark: "docket" in Archivo ExtraBold, ink. Colours come from CSS tokens; see the docket-brand skill.
 */

/** Shared geometry so the animation scene (LogoWalkthrough) can draw the same mark with a split door. */
export const LOGO_D_PATH = "M0 0H40A45 46 0 0 1 40 92H0Z";
export const LOGO_HOUSE_PATH = "M38.5 27L59 47.5V70H18V47.5Z";
export const LOGO_DOOR = { x: 34, y: 56, width: 9.5, height: 14 } as const;

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
      <path d={LOGO_D_PATH} fill="var(--primary)" />
      <path d={LOGO_HOUSE_PATH} fill="var(--white)" />
      <rect x={LOGO_DOOR.x} y={LOGO_DOOR.y} width={LOGO_DOOR.width} height={LOGO_DOOR.height} fill="var(--logo-door)" />
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
