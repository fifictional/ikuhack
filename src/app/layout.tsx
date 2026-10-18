import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { LawCheckFooter } from "@/components/LawCheckFooter";
import { RoleNavLink, SessionNav } from "@/components/SessionNav";
import { I18nProvider, LanguageSwitcher, T } from "@/components/i18n/I18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face for the wordmark and headings (matches the logo's heavy grotesque).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  // Pages set a short title ("Your repairs"); the template adds the brand.
  title: { default: "Docket — rental repairs, on the clock and on the record", template: "%s — Docket" },
  description: "Report any repair in seconds. Docket works out the landlord's legal deadline and keeps tamper-evident evidence for both sides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
        <header className="border-b border-border bg-background">
          <nav className="mx-auto flex max-w-5xl items-center gap-x-4 px-4 py-3 text-sm sm:gap-x-6">
            <Link href="/" aria-label="Docket home" className="me-2">
              <Logo size={24} />
            </Link>
            {/* Both read the session cookie, so each needs its own boundary to keep the header static. */}
            <Suspense fallback={null}>
              <RoleNavLink />
            </Suspense>
            <Link href="/proof" className="hidden font-medium text-ink/80 hover:text-primary sm:inline"><T k="nav.proof" /></Link>
            <Link href="/verify" className="hidden font-medium text-ink/80 hover:text-primary sm:inline"><T k="nav.verify" /></Link>
            <div className="ms-auto flex items-center gap-4">
              {/* Session read must live in its own boundary so the header still prerenders. */}
              <Suspense fallback={null}>
                <SessionNav />
              </Suspense>
              {/* Language button sits in the top-right corner on every screen size. */}
              <LanguageSwitcher />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-16">{children}</main>
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background">
          {/* Reads the DB, so it streams in behind a boundary on every page. */}
          <Suspense fallback={null}>
            <LawCheckFooter />
          </Suspense>
        </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
