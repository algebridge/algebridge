import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import "./helper.css";
import "./polish.css";
import Link from "next/link";
import { Header } from "@/components/Header";
import { SideNav } from "@/components/SideNav";
import { AppNavProvider } from "@/components/AppNavProvider";
import { SmoothScroll } from "@/components/SmoothScroll";
import { DotPattern } from "@/components/ui/dot-pattern";
import { LoginBanner } from "@/components/LoginBanner";
import { AppInit } from "@/components/AppInit";
import { Analytics } from "@/components/Analytics";
import { AuthProvider } from "@/lib/auth";
import { MusicCredits } from "@/components/MusicCredits";
import { Calculator } from "@/components/Calculator";
import { StudyHelper } from "@/components/StudyHelper";
import { sidebarBootScript } from "@/lib/sidebar";
import { bareRouteBootScript } from "@/lib/bare-route";
import { IncomingCall } from "@/components/IncomingCall";
import { ScratchpadProvider } from "@/components/Scratchpad";

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
  // Search Console ownership of learn.algebridge.org (the same token verifies algebridge.org).
  verification: { google: "IeZni3c_m0n9Y9cXaDHAdbJ1JSt1FNoZM44xfhoIA1s" },
  // Every page names itself in the tab ("Achievements, AlgeBridge"); a page
  // with no title of its own gets the default.
  title: {
    default: "AlgeBridge, free Algebra 1 for grades 7 to 10",
    template: "%s, AlgeBridge",
  },
  description:
    "Bridge the gap from arithmetic to algebra. Free Algebra 1 learning with videos, practice, live tutors, and mastery tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the script below may set the sidebar's width
    // and dock flag on <html> before React starts. One level deep only.
    <html lang="en" className={`${anton.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Room for Archie's sidebar from the first frame when it was left open. */}
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript() }} />
        {/* /try and other bare routes: the shell is hidden from the first frame (lib/bare-route.ts). */}
        <script dangerouslySetInnerHTML={{ __html: bareRouteBootScript() }} />
      </head>
      <body className="min-h-screen bg-slate-50 font-body">
        {/* First in the Tab order: past the menus, straight to the page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-bridge-700 focus:shadow-raised focus:outline-none focus:ring-2 focus:ring-bridge-500"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <AppNavProvider>
          <ScratchpadProvider>
            <SmoothScroll />
            <AppInit />
            <Analytics />
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
              {/* Everything under the header moves over for the docked AI
                  sidebar (helper.css: .helper-shift). The header stays full width. */}
              <div className="helper-shift flex flex-1 flex-col">
              <LoginBanner />
              <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 scroll-mt-14 px-4 py-7 focus:outline-none sm:px-6 lg:px-8">
                {children}
              </main>
              {/* pb-32 on phones: the calculator and Archie buttons stack in the
                  bottom right corner (about 120px tall), so the last line can
                  scroll up clear of them. */}
              <footer className="border-t border-slate-200 bg-white px-4 pb-32 pt-8 text-center text-sm text-slate-500 sm:px-6 sm:pb-8">
                <p>Free forever. Videos, practice, and real tutors. Algebra&nbsp;1, grades 7-10.</p>
                {/* py-1 makes each link a 24 px tall target (WCAG 2.5.8) where the links wrap on a phone. */}
                <nav aria-label="Footer" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs [&>a]:py-1">
                  <Link href="/schools" className="font-medium text-slate-600 hover:text-bridge-600">For schools</Link>
                  <Link href="/privacy" className="hover:text-bridge-600">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-bridge-600">Terms of Service</Link>
                  <Link href="/safety" className="hover:text-bridge-600">Safety &amp; Trust</Link>
                  <Link href="/guidelines" className="hover:text-bridge-600">Community Guidelines</Link>
                  <Link href="/feedback" className="hover:text-bridge-600">Feedback</Link>
                  <a href="mailto:support@algebridge.org" className="hover:text-bridge-600">Contact</a>
                </nav>
                <p className="mt-3 text-xs text-slate-400">
                  © {new Date().getFullYear()} AlgeBridge
                </p>
                <MusicCredits />
              </footer>
              </div>
            </div>
            <Calculator />
            <StudyHelper />
          </ScratchpadProvider>
          </AppNavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
