# Website languages

Accessibility for tenants who aren't confident in English is a core part of Docket.

**Languages:** English, Polski, العربية (right-to-left), Română, Español, Русский, Türkçe, हिन्दी. Every one is also a language the voice agent can speak.

## How it works
- The **language switcher** (🌐 in the header) sets the `docket-lang` cookie. It's hidden on landlord and demo pages.
- **Tenant pages** (`/tenant/*`) read the cookie on the server (`getLocale()` in `src/lib/i18n/server.ts`), so they render straight in the chosen language with no flash of English. `src/app/tenant/layout.tsx` sets `lang` and `dir`.
- **Shared pages** (home, sign-in, header) translate on the client through `<I18nProvider>` and `<T k="…"/>`.
- **Text lives in** `src/lib/i18n/messages/{en,pl,ar,ro,es,ru,tr,hi}.ts`. English is the source, and the `Messages` type makes every language provide every key, so a missing translation fails the typecheck.
- **Listen** speaks in the language the page is shown in, and the live call defaults to it.

## What stays in English, on purpose
- **Landlord and demo screens:** these are pinned to English with `<LocaleScope locale="en">`.
- **Legal citations:** statute and regulation names. Each has a translated plain-language explanation next to it.
- **The record:** case titles, history entries, notes, "what Docket believed", and the full event log. These are evidence. Tenants can tap **Listen** to hear an update in their language.
- **Letters and the PDF bundle:** they go to landlords, councils or courts.
- **Proper names:** Docket, Housing Ombudsman, and the "pre-action protocol" / "letter of claim" terms.

A short note on tenant case pages explains this in the tenant's language.

## Adding or changing text
1. Add the key to `en.ts`.
2. The typecheck then lists every language missing it. Add a translation to each.
3. Use `useT()` / `<T k>` in client components, or `translator(locale)` in server components.

Use start/end Tailwind classes (`ms-*`, `text-end`, `start-*`), not left/right, so Arabic lays out correctly.

**Translations are drafts:** written carefully, but each should be reviewed by a native speaker before real-world use.
