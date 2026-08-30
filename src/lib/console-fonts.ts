import { DM_Mono, Manrope, Newsreader } from "next/font/google";

/**
 * Fonts for the operator console only. The student app uses Anton + Inter; the
 * console borrows the Somba CRM's paper/ink trio so it reads as a separate
 * tool rather than another course page.
 */

const consoleDisplay = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-console-display",
  display: "swap",
});

const consoleBody = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-console-body",
  display: "swap",
});

const consoleMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-console-mono",
  display: "swap",
});

export const consoleFontClass = `${consoleDisplay.variable} ${consoleBody.variable} ${consoleMono.variable}`;
