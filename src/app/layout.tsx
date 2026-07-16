import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LoginBanner } from "@/components/LoginBanner";
import { AppInit } from "@/components/AppInit";
import { AuthProvider } from "@/lib/auth";
import { MusicCredits } from "@/components/MusicCredits";
import { Calculator } from "@/components/Calculator";
import { IncomingCall } from "@/components/IncomingCall";

// Bold condensed display font — matches the AlgeBridge wordmark.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

// Clean, highly-readable body font.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "AlgeBridge — Learn Algebra 1",
  description:
    "Bridge the gap from arithmetic to algebra. Free Algebra 1 learning with videos, practice, live tutors, and mastery tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-white font-body">
        <AuthProvider>
          <AppInit />
          <IncomingCall />
          <Header />
          <LoginBanner />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
            <p>
              AlgeBridge — Free forever. Learn with videos, practice, and real tutors.
            </p>
            <p className="mt-1">Grades 7–10 · Algebra 1 · {new Date().getFullYear()}</p>
            <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
              <Link href="/privacy" className="hover:text-bridge-600">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-bridge-600">Terms of Service</Link>
              <Link href="/safety" className="hover:text-bridge-600">Safety &amp; Trust</Link>
              <a href="mailto:support@algebridge.org" className="hover:text-bridge-600">Contact</a>
            </nav>
            <MusicCredits />
          </footer>
          <Calculator />
        </AuthProvider>
      </body>
    </html>
  );
}
