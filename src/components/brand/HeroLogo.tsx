"use client";

import { useEffect, useRef } from "react";
import { LOGO_DOOR, LOGO_D_PATH, LOGO_HOUSE_PATH } from "@/components/brand/Logo";
import { registerDoorScene } from "@/components/brand/LogoWalkthrough";

/**
 * The hero logo on the homepage. It looks exactly like LogoMark, except its door is drawn as a
 * black doorway with two grey panels on top — the panels are what slide open. On mount it registers
 * the wrapper box (zoomed by the transition) plus the door elements so they can be animated in place.
 */
export function HeroLogo({ size = 120, className }: { size?: number; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const doorwayRef = useRef<SVGRectElement>(null);
  const leftRef = useRef<SVGRectElement>(null);
  const rightRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const doorway = doorwayRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (box && doorway && left && right) {
      registerDoorScene({ box, doorway, left, right });
      return () => registerDoorScene(null);
    }
  }, []);

  return (
    <div ref={boxRef} className={className}>
      <svg viewBox="0 0 85 92" width={(size * 85) / 92} height={size} className="block" role="img" aria-label="Docket">
        <path d={LOGO_D_PATH} fill="var(--primary)" />
        <path d={LOGO_HOUSE_PATH} fill="var(--white)" />
        {/* The dark doorway, revealed when the panels part. */}
        <rect ref={doorwayRef} x={LOGO_DOOR.x} y={LOGO_DOOR.y} width={LOGO_DOOR.width} height={LOGO_DOOR.height} fill="var(--primary-dark)" />
        {/* Two door panels covering the doorway; they slide open sideways. */}
        <rect ref={leftRef} x={LOGO_DOOR.x} y={LOGO_DOOR.y} width={LOGO_DOOR.width / 2} height={LOGO_DOOR.height} fill="var(--logo-door)" />
        <rect ref={rightRef} x={LOGO_DOOR.x + LOGO_DOOR.width / 2} y={LOGO_DOOR.y} width={LOGO_DOOR.width / 2} height={LOGO_DOOR.height} fill="var(--logo-door)" />
      </svg>
    </div>
  );
}
