import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Docket — rental repairs, on the clock and on the record",
  description: "Report any repair in seconds. Docket works out the landlord's legal deadline and keeps tamper-evident evidence for both sides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-semibold tracking-tight">Docket</Link>
            <Link href="/tenant" className="text-muted hover:text-foreground">Tenant</Link>
            <Link href="/landlord" className="text-muted hover:text-foreground">Landlord</Link>
            <Link href="/verify" className="text-muted hover:text-foreground">Verify</Link>
            <Link href="/demo" className="ml-auto text-muted hover:text-foreground">Demo controls</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
