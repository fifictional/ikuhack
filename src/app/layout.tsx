import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { Logo } from "@/components/brand/Logo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face for the wordmark and headings (matches the logo's heavy grotesque).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Docket — rental repairs, on the clock and on the record",
  description: "Report any repair in seconds. Docket works out the landlord's legal deadline and keeps tamper-evident evidence for both sides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-background">
          <nav className="mx-auto flex max-w-5xl items-center gap-x-4 px-4 py-3 text-sm sm:gap-x-6">
            <Link href="/" aria-label="Docket home" className="mr-2">
              <Logo size={24} />
            </Link>
            <Link href="/tenant" className="font-medium text-ink/80 hover:text-primary">Tenant</Link>
            <Link href="/landlord" className="font-medium text-ink/80 hover:text-primary">Landlord</Link>
            <Link href="/proof" className="hidden font-medium text-ink/80 hover:text-primary sm:inline">Proof</Link>
            <Link href="/verify" className="hidden font-medium text-ink/80 hover:text-primary sm:inline">Verify</Link>
            <Link href="/demo" className="ml-auto hidden font-medium text-ink/80 hover:text-primary sm:inline">Demo</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
