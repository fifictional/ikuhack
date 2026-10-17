---
name: docket-brand
description: Docket's visual system: greyscale palette, type, logo and component styles. Use for ANY change to Docket's UI (pages, components, Tailwind classes, CSS, the PDF bundle, favicon, demo screenshots or pitch visuals), even a one-line style tweak, so everything stays consistent.
---

# Docket brand (greyscale)

Logo: `src/components/brand/Logo.tsx` (`<Logo />`, `<LogoMark />`); favicon `src/app/icon.svg`. The shape is a "D" with a house cut-out and a door, traced from `public/brand-reference.png`. That reference is the original colour version: **keep the shape, ignore its colours.**
Tokens live in `src/app/globals.css`. **Never hardcode hex values or use Tailwind's default palette** (`bg-blue-600`, `text-gray-500`, `bg-white`…). Use the tokens below.

## Palette: greyscale only

| Token (Tailwind) | Hex | Use for |
|---|---|---|
| `primary` | `#1A1A1A` | Primary buttons, links, active states, focus ring |
| `primary-dark` | `#000000` | Hover/pressed on primary |
| `primary-tint` | `#EDEDED` | Subtle highlight backgrounds (key cards, hover on outline buttons) |
| `highlight` | `#4A4A4A` | Secondary emphasis fills: "speaking" / "recording" states, small markers |
| `highlight-dark` | `#333333` | Text on `highlight-tint` |
| `highlight-tint` | `#E8E8E8` | Recording / active-state backgrounds |
| `ink` | `#1A1A1A` | All body text and headings (`text-foreground` = ink) |
| `muted` | `#6B6B6B` | Secondary text |
| `panel` | `#EFEFEF` | Grouped areas (transcript box, demo blocks) |
| `background` | `#F7F7F7` | Page background and header |
| white | `#FFFFFF` | Cards and panels (`bg-surface`) |
| `border` | `#E4E4E4` | Hairlines and card borders |

**The only colour is status, on deadlines and verdicts:** `warn` amber `#9A5B00` (due within 24h), `danger` red `#C62828` (legal deadline missed, errors), `ok` green `#1B7F3B` (met). Don't use them decoratively.

**Contrast:** ink and primary pass easily on every background. `muted` is ≥ 5:1 on white and the page background. White text on `primary`/`highlight` passes.

## Type
- **Display:** Archivo (`font-display`), weights 700–800, `tracking-tight`, for the wordmark and h1/h2 (applied globally).
- **Body:** Geist Sans. **Numbers and countdowns:** Geist Mono.
- The wordmark is always lowercase **"docket"** in ink, next to the mark.

## Logo
- Use `<Logo size={…} />` in headers and `<LogoMark />` for icons and heroes. The mark is a near-black D, a white house and a grey door (`--logo-door`).
- Don't recolour, outline or stretch it. Place it on the page background or white.

## Component patterns (copy these)
- **Primary button:** `rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50`
- **Secondary button:** `rounded-lg border border-primary px-4 py-2 font-medium text-primary hover:bg-primary-tint`
- **Quiet button:** `rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-primary`
- **Card:** `rounded-xl border border-border bg-surface p-4` (section headings `text-sm font-semibold uppercase tracking-wide text-muted`)
- **Key card** ("What happens next"): `rounded-xl border-2 border-primary bg-primary-tint p-4`; when breached use `border-danger bg-surface`.
- **Pills:** `rounded-full border border-border px-2 py-0.5 text-muted`; danger pill `border-danger text-danger`.
- **Links:** `font-medium text-primary underline`

## Tone
Calm, plain English, never alarmist. Only fixed periods in law (`legalBasis.deadline === "law"`) are called a "legal deadline". A legal duty with no fixed period (s11, s9A) is a "legal duty" with "Docket's target time". Pure Docket standards are a "Docket target (not a legal deadline)". Use `deadlineLabel()` from `src/lib/ui/labels.ts`.

## Checklist before finishing any UI change
1. `grep -rnE "#[0-9a-fA-F]{6}|bg-(white|black|gray|blue|red|green|orange|amber|slate)" src --include=*.tsx` returns nothing new.
2. No colour outside greyscale except status (`warn`/`danger`/`ok`).
3. Check the page at phone width (375px) and desktop.
4. Interactive elements keep the focus ring (don't remove outlines).
