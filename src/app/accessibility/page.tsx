import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

/*
 * The accessibility statement: what works today for a student or teacher
 * who uses a keyboard, a screen reader, larger text or less motion, what
 * does not yet, and how to report a problem. Every line was checked against
 * the code on 16 October 2026: src/app/layout.tsx (the skip link, footer
 * targets), src/app/polish.css (focus outlines), src/components/PracticePanel.tsx
 * (Enter, 1 to 9, the arrow keys, the status line, the answer box),
 * src/hooks/useSpeech.ts, src/lib/display.ts with DisplayMenu.tsx,
 * src/app/globals.css (16px fields on touch screens), the contrast checks in
 * src/lib/__tests__/practice.test.ts, src/components/useDialogFocus.ts, the
 * games (SVG), house/House3D.tsx (canvas), StudyHelper.tsx and VideoPlayer.tsx.
 * When a feature changes, change this page with it, and the review date.
 */

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "How AlgeBridge works with a keyboard, a screen reader, larger text and less motion, what does not work yet, and how to report a problem.",
};

/** The date this page was last checked against the code. */
const REVIEWED = "October 16, 2026";

const WORKS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "keyboard",
    title: "Keyboard",
    body: "The pages work from the keyboard, and the first Tab stop on each one is a Skip to main content link. On a practice card, Enter checks the answer and Enter again moves to the next problem, the keys 1 to 9 pick a multiple-choice answer, the arrow keys move across the choices, and Escape closes a dialog.",
  },
  {
    icon: "eye",
    title: "Visible focus",
    body: "Links, buttons, tabs and fields show a 2px blue outline when reached by keyboard. On a colored banner the outline turns white, so it stays visible.",
  },
  {
    icon: "messages",
    title: "Screen readers",
    body: "A status line on the practice card announces each new problem and each verdict. The answer box is described by its problem, buttons that show only an icon carry a text label, and Archie's conversation is marked as a log, with each reply announced once in full.",
  },
  {
    icon: "speaker",
    title: "Read aloud",
    body: "A speaker button reads the problem aloud, and another reads the hint, with the voice built into the device. Math is spoken as words: × as times, √ as square root of, x² as x squared. The buttons show where the browser has speech built in.",
  },
  {
    icon: "text-size",
    title: "Text size and motion",
    body: "The Display menu in the header, in the phone menu and on the account page sets the text size in three steps, normal, large and largest, and has a Reduce motion switch that stops animations the way the device's own setting does. Both are saved on that device, with or without an account, and applied before the page first paints.",
  },
  {
    icon: "phone",
    title: "Touch screens",
    body: "Small text fields read at 16px on a touch screen, so an iPhone does not zoom the page when one is focused, and small text links and buttons are at least 24px tall to tap.",
  },
  {
    icon: "check",
    title: "Color contrast",
    body: "A test that runs with the practice tests checks the gray text colors and every unit and interest hue against the 4.5:1 floor for text, on every surface they can land on.",
  },
  {
    icon: "close",
    title: "Dialogs",
    body: "A dialog takes the keyboard when it opens, keeps Tab and Shift+Tab inside it, closes on Escape, and puts the keyboard back where it was.",
  },
];

const GAPS: { title: string; body: string }[] = [
  {
    title: "The sports games",
    body: "The games are animated scenes drawn in SVG. The arrow keys or W A S D move your player (a second player takes the other set), Escape leaves the game, and each head-math problem comes up in an ordinary dialog. But a screen reader hears the game's name and its keys, not where the ball and the players are, and on a phone the game is played by dragging.",
  },
  {
    title: "The 3D Bridgey House",
    body: "The house is drawn on a canvas. W A S D or the arrow keys walk your character, R turns a selected piece, Escape lets go of a piece or stops a walk, and the canvas carries a short description of the view. But moving a piece means dragging it and using one means tapping it, so a keyboard alone cannot arrange a room, and the rooms themselves are not read out.",
  },
  {
    title: "Archie's reactions",
    body: "Archie's chat is text. His reactions to an answer are visual: his pose and the short line in his bubble are hidden from screen readers. The verdict itself is announced by the practice card, so only the cheer is missed.",
  },
  {
    title: "Lesson videos",
    body: "Lesson videos are YouTube embeds from public math channels. Captions are whatever YouTube offers for that video; AlgeBridge adds none of its own.",
  },
  {
    title: "No VPAT yet",
    body: "There is no VPAT (Voluntary Product Accessibility Template) and no third-party audit yet. This page is the team's own review of the code, and it will change as the gaps above close.",
  },
];

export default function AccessibilityPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="eyebrow">Accessibility statement</p>
      <h1 className="page-title">Accessibility</h1>
      <p className="mt-3 text-slate-600">
        AlgeBridge is built to work on a school Chromebook, a phone and a projector, with a keyboard, a screen
        reader, larger text or less motion. This page says what works today, what does not yet, and how to tell us
        when something gets in a student&apos;s way.
      </p>
      <p className="mt-2 text-sm text-slate-500">Last reviewed: {REVIEWED}</p>

      <section aria-labelledby="standard-title" className="panel mt-6">
        <div className="panel-head">
          <h2 id="standard-title" className="panel-title">
            The standard we aim for
          </h2>
        </div>
        <div className="panel-body space-y-2 text-sm leading-relaxed text-slate-700">
          <p>AlgeBridge aims to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA.</p>
          <p>
            This statement comes from a review of the app&apos;s own code by the AlgeBridge team on {REVIEWED}. It is
            not a third-party audit, and AlgeBridge does not claim conformance yet. What was checked is below, and so
            is what has not been fixed.
          </p>
        </div>
      </section>

      <section aria-labelledby="works-title" className="mt-8">
        <h2 id="works-title" className="section-title">
          What works now
        </h2>
        <ul className="mt-3 grid gap-3">
          {WORKS.map((w) => (
            <li key={w.title} className="card flex gap-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bridge-50 text-bridge-600 ring-1 ring-inset ring-bridge-100"
                aria-hidden="true"
              >
                <Icon name={w.icon} size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900">{w.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{w.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gaps-title" className="panel mt-8">
        <div className="panel-head">
          <h2 id="gaps-title" className="panel-title">
            Known gaps
          </h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {GAPS.map((g) => (
            <li key={g.title} className="px-5 py-4">
              <h3 className="font-semibold text-slate-900">{g.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{g.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="report-title" className="mt-8 rounded-xl bg-bridge-50 p-5 text-bridge-900">
        <h2 id="report-title" className="font-bold">
          Report a problem
        </h2>
        <p className="mt-1 text-sm leading-relaxed">
          Email{" "}
          <a href="mailto:support@algebridge.org" className="font-semibold underline">
            support@algebridge.org
          </a>{" "}
          or use the{" "}
          <Link href="/feedback" className="font-semibold underline">
            Feedback page
          </Link>
          , which works with or without an account. Say which page it was, what you were using (a screen reader, the
          keyboard alone, a phone, larger text) and what happened.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/schools" className="btn-secondary">For schools</Link>
        <Link href="/privacy" className="btn-secondary">Privacy Policy</Link>
        <Link href="/safety" className="btn-secondary">Safety &amp; Trust</Link>
      </div>
    </article>
  );
}
