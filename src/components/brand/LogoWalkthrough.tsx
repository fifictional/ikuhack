"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The "walk through the door" transition on the homepage. A link calls playLogoWalkthrough(href).
 * The sequence: the page softly dims, the view zooms into the real hero logo, its door slides
 * open, the black pours out of the door to cover the screen, then the page reloads to the target
 * URL. A full reload means the new page renders fresh — nothing from the transition can linger.
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

const ZOOM = 2.5;

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

    // 1. Softly dim the page so the change doesn't come out of the blue.
    dim.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: 400, easing: "ease-out", fill: "forwards" });

    // 2. Zoom the view into the real hero logo: scale it up and carry it to the centre of the screen.
    if (scene) {
      const box = scene.box;
      const r = box.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const dx = window.innerWidth / 2 - (r.left + r.width / 2);
        const dy = window.innerHeight / 2 - (r.top + r.height / 2);
        box.style.position = "relative";
        box.style.zIndex = "40";
        box.animate(
          [
            { transform: "translate(0px, 0px) scale(1)" },
            { transform: `translate(${dx}px, ${dy}px) scale(${ZOOM})` },
          ],
          { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
        );
      }
    }

    // 3. Once the zoom lands, slide the door open (its size is measured after the zoom).
    later(520, () => {
      if (!scene) return;
      const r = scene.doorway.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      const half = r.width / 2;
      scene.left.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-half}px)` }], {
        duration: 420,
        easing: "ease-out",
        fill: "forwards",
      });
      scene.right.animate([{ transform: "translateX(0)" }, { transform: `translateX(${half}px)` }], {
        duration: 420,
        easing: "ease-out",
        fill: "forwards",
      });
    });

    // 4. The black pours out of the (now open, zoomed) door.
    later(760, () => {
      const r = scene?.doorway.getBoundingClientRect();
      const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
      const size = Math.hypot(window.innerWidth, window.innerHeight) * 2;
      portal.style.width = `${size}px`;
      portal.style.height = `${size}px`;
      portal.style.left = `${cx}px`;
      portal.style.top = `${cy}px`;
      portal.animate(
        [
          { transform: "translate(-50%, -50%) scale(0)" },
          { transform: "translate(-50%, -50%) scale(1)" },
        ],
        { duration: 450, easing: "ease-in-out", fill: "forwards" },
      );
    });

    // 5. Full page load: the new page renders from scratch, nothing lingers.
    later(1250, () => window.location.assign(href));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [href]);

  return (
    <div ref={overlayRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      <div ref={dimRef} className="absolute inset-0 bg-primary-dark" style={{ opacity: 0 }} />
      <div
        ref={portalRef}
        className="absolute bg-primary-dark"
        style={{ width: 0, height: 0, opacity: 1, transform: "translate(-50%, -50%) scale(0)" }}
      />
    </div>
  );
}
