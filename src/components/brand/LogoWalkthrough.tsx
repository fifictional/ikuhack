"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The "walk through the door" transition on the homepage. A link calls playLogoWalkthrough(href).
 * The sequence: the page softly dims, the view moves into the real hero logo, its door slides open,
 * the black grows out of the doorway to cover the screen, then the page reloads to the target URL.
 *
 * Two things keep it smooth rather than stepped:
 *  - each phase starts just before the last one finishes, so the move is continuous;
 *  - every animated element is promoted to its own layer up front, so the first frame doesn't hitch.
 */

type DoorScene = { box: HTMLDivElement; doorway: SVGRectElement; left: SVGRectElement; right: SVGRectElement };

let scene: DoorScene | null = null;

/** Called by HeroLogo on mount/unmount so the transition can animate the real on-page logo. */
export function registerDoorScene(s: DoorScene | null): void {
  scene = s;
}

let play: ((href: string) => void) | null = null;

/** Called by WalkThroughLink on click. Safe to call before the overlay mounts (no-op). */
export function playLogoWalkthrough(href: string): void {
  play?.(href);
}

const ZOOM = 2.4;
/** One gentle, slightly decelerating curve for every phase, so the whole move feels of a piece. */
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export function LogoWalkthrough() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    play = setHref;
    return () => {
      play = null;
    };
  }, []);

  // Play the transition when a link fires.
  useEffect(() => {
    if (!href) return;
    const overlay = overlayRef.current;
    const dim = dimRef.current;
    const portal = portalRef.current;
    if (!overlay || !dim || !portal) return;

    // Respect "reduce motion": skip straight to the destination.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.location.assign(href);
      return;
    }

    overlay.style.pointerEvents = "auto";
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    // Promote to their own layers before touching them, so the first animated frame is smooth.
    dim.style.willChange = "opacity";
    portal.style.willChange = "transform";

    // 1. The page dims gently, so the change is announced rather than sudden.
    dim.animate([{ opacity: 0 }, { opacity: 0.4 }], { duration: 500, easing: EASE, fill: "forwards" });

    // 2. The view moves into the real hero logo, easing to a stop instead of snapping to one.
    if (scene) {
      const box = scene.box;
      box.style.position = "relative";
      box.style.zIndex = "40";
      box.style.willChange = "transform";
      const r = box.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const dx = window.innerWidth / 2 - (r.left + r.width / 2);
        const dy = window.innerHeight / 2 - (r.top + r.height / 2);
        box.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1)" },
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${ZOOM})` },
          ],
          { duration: 700, easing: EASE, fill: "forwards" },
        );
      }
    }

    // 3. The door starts opening while the zoom is still settling, so there is no dead beat.
    later(400, () => {
      if (!scene) return;
      const r = scene.doorway.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      const half = r.width / 2;
      scene.left.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-half}px)` }], {
        duration: 520,
        easing: EASE,
        fill: "forwards",
      });
      scene.right.animate([{ transform: "translateX(0)" }, { transform: `translateX(${half}px)` }], {
        duration: 520,
        easing: EASE,
        fill: "forwards",
      });
    });

    // 4. Black grows out of the doorway itself: it starts as the door-sized opening and eases
    //    outward until it covers the screen, rather than popping out of a single point.
    later(720, () => {
      const r = scene?.doorway.getBoundingClientRect();
      const doorW = r && r.width > 0 ? r.width : 24;
      const doorH = r && r.height > 0 ? r.height : 32;
      const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
      // How far the doorway must grow before its shorter side spans the whole screen.
      const cover = (Math.hypot(window.innerWidth, window.innerHeight) * 2) / Math.min(doorW, doorH);
      portal.style.width = `${doorW}px`;
      portal.style.height = `${doorH}px`;
      portal.style.left = `${cx}px`;
      portal.style.top = `${cy}px`;
      portal.animate(
        [
          { transform: "translate3d(-50%, -50%, 0) scale(1)" },
          { transform: `translate3d(-50%, -50%, 0) scale(${cover})` },
        ],
        { duration: 680, easing: EASE, fill: "forwards" },
      );
    });

    // 5. Hold on the black for a beat, then load the new page fresh.
    later(1520, () => window.location.assign(href));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [href]);

  return (
    <div ref={overlayRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      <div ref={dimRef} className="absolute inset-0 bg-primary-dark" style={{ opacity: 0 }} />
      <div
        ref={portalRef}
        className="absolute bg-primary-dark"
        style={{ width: 0, height: 0, opacity: 1, transformOrigin: "center", transform: "translate3d(-50%, -50%, 0) scale(1)" }}
      />
    </div>
  );
}
