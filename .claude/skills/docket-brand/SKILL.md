---
name: docket-brand
description: Docket's brand system: colours, type, logo and component styles. Use for ANY change to Docket's UI (pages, components, Tailwind classes, CSS, the PDF bundle, favicon, demo screenshots or pitch visuals), even a one-line style tweak, so everything stays on-brand.
---

# Docket brand

Reference logo: `public/brand-reference.png`. SVG rebuild: `src/components/brand/Logo.tsx` (`<Logo />`, `<LogoMark />`); favicon `src/app/icon.svg`.
Tokens live in `src/app/globals.css`. **Never hardcode hex values or use Tailwind's default palette** (`bg-blue-600`, `text-gray-500`, `bg-white`…). Use the tokens below.

## Palette: brand colours + white and cream only

| Token (Tailwind) | Hex | Use for |
|---|---|---|
| `teal` | `#125951` | Primary: buttons, links, active states, focus ring, "on track" |
| `teal-dark` | `#0C403A` | Hover/pressed on teal |
| `teal-tint` | `#E4EFEC` | Subtle teal backgrounds (highlight cards, hover on outline buttons) |
| `terracotta` | `#C65729` | Accent *fills only*: small bars, icons, door in the logo, "live/speaking" states. Never small text |
| `terracotta-dark` | `#A4461F` | Terracotta *text*, and the `warn` role (due within 24h) |
| `terracotta-tint` | `#F6E4DA` | Subtle warm backgrounds |
| `ink` | `#2B2620` | All body text and headings (`text-foreground` = ink) |
| `muted` | `#6B6158` | Secondary text on white/cream-soft |
| `cream` | `#E9DDC7` | Brand cream: header, hero blocks |
| `cream-soft` | `#F6F1E7` | Page background (`bg-background`) |
| white | `#FFFFFF` | Cards and panels (`bg-surface`) |
| `border` | `#DDD0B8` | Hairlines and card borders |

Status roles: `ok` = teal, `warn` = terracotta-dark, `danger` = `#A61B1B` (deadline breached only). Breaches are the one place a red appears. Don't use terracotta for errors.

**Contrast rules (WCAG AA):**
- Ink is fine on everything.
- Teal text is fine on white, cream-soft and cream; white text on teal is 8.2:1.
- `muted` text only on white or cream-soft, not on `cream` (4.5:1, borderline).
- Terracotta `#C65729` is 4.4:1 on white, so it is never used for text below 24px. Use `terracotta-dark` for text.

## Type
- **Display:** Archivo (`font-display`, loaded in `layout.tsx`), weights 700–800, `tracking-tight`. Used for the wordmark and h1/h2 (applied globally in `globals.css`).
- **Body:** Geist Sans. **Numbers and countdowns:** Geist Mono.
- Wordmark is always lowercase **"docket"**, in ink, next to the mark.

## Logo
- Use `<Logo size={…} />` (mark + wordmark) in headers and `<LogoMark />` alone for icons, heroes and favicons.
- Keep the mark's colours (teal D, cream house, terracotta door). Don't recolour, outline or stretch it.
- Place it on cream, cream-soft or white backgrounds, never on teal.
- Leave clear space around it of at least half the mark's width.

## Component patterns (copy these)
- **Primary button:** `rounded-lg bg-teal px-4 py-2 font-semibold text-white hover:bg-teal-dark disabled:opacity-50`
- **Secondary button:** `rounded-lg border border-teal px-4 py-2 font-medium text-teal hover:bg-teal-tint`
- **Quiet button:** `rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-teal hover:text-teal`
- **Card:** `rounded-xl border border-border bg-surface p-4` (section headings `text-sm font-semibold uppercase tracking-wide text-muted`)
- **Highlight card** (the one thing that matters, e.g. "What happens next"): `rounded-xl border-2 border-teal bg-teal-tint p-4`; when breached use `border-danger bg-surface`.
- **Hero/brand block:** `rounded-2xl bg-cream px-6 py-10`
- **Accent bar** (decorative): `h-1 w-10 rounded-full bg-terracotta`
- **Pills:** `rounded-full border border-border px-2 py-0.5 text-muted`; danger pill `border-danger text-danger`.
- **Links:** `font-medium text-teal underline`

## Tone
Calm, plain English, never alarmist. Legal deadlines are labelled "legal deadline". Docket targets are labelled "Docket target (not a legal deadline)". Copy reads to tenants as "Your landlord must…" and "You need to…".

## Checklist before finishing any UI change
1. `grep -rnE "#[0-9a-fA-F]{6}|bg-(white|black|gray|blue|red|green|orange|amber|slate)" src --include=*.tsx` returns nothing new.
2. Text colours meet the contrast rules above (especially terracotta).
3. Check the page at phone width (375px) and desktop.
4. Interactive elements show the teal focus ring (don't remove outlines).
