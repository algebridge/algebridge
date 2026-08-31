import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Header } from "@/components/Header";
import { SideNav } from "@/components/SideNav";
import { AppNavProvider } from "@/components/AppNavProvider";
import { SmoothScroll } from "@/components/SmoothScroll";
import { DotPattern } from "@/components/ui/dot-pattern";
import { LoginBanner } from "@/components/LoginBanner";
import { AppInit } from "@/components/AppInit";
import { AuthProvider } from "@/lib/auth";
import { MusicCredits } from "@/components/MusicCredits";
import { Calculator } from "@/components/Calculator";
import { StudyHelper } from "@/components/StudyHelper";
import { IncomingCall } from "@/components/IncomingCall";

// Bold condensed display font, matches the AlgeBridge wordmark.
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
  title: "AlgeBridge - Learn Algebra 1",
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
      <body className="min-h-screen bg-slate-50 font-body">
        <AuthProvider>
          <AppNavProvider>
            <SmoothScroll />
            <AppInit />
            <IncomingCall />
            <SideNav />

            {/* Page texture: an even, quiet dot field behind everything.
                Fixed, so it stays put while the page scrolls over it. No mask -
                a fade would land under the header, where nothing can see it. */}
            <DotPattern
              width={22}
              height={22}
              cr={1}
              className="fixed inset-0 -z-10 h-full w-full fill-slate-400/45"
            />

            <div className="flex min-h-screen flex-col lg:pl-60">
              <Header />
              <LoginBanner />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 lg:px-8">
                {children}
              </main>
              <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
                <p>Free forever. Videos, practice, and real tutors. Algebra 1, grades 7-10.</p>
                <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                  <Link href="/privacy" className="hover:text-bridge-600">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-bridge-600">Terms of Service</Link>
                  <Link href="/safety" className="hover:text-bridge-600">Safety &amp; Trust</Link>
                  <Link href="/guidelines" className="hover:text-bridge-600">Community Guidelines</Link>
                  <a href="mailto:support@algebridge.org" className="hover:text-bridge-600">Contact</a>
                </nav>
                <p className="mt-3 text-xs text-slate-400">
                  © {new Date().getFullYear()} AlgeBridge
                </p>
                <MusicCredits />
              </footer>
            </div>
            <Calculator />
            <StudyHelper />
          </AppNavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
