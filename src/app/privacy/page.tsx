import Link from "next/link";

export const metadata = { title: "Privacy Policy, AlgeBridge" };

export default function PrivacyPage() {
  return (
    <article className="prose-slate mx-auto max-w-2xl">
      <h1 className="page-title">Privacy Policy</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: October 2026</p>

      <div className="mt-6 space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Who we are</h2>
          <p className="mt-2">
            AlgeBridge is a free Algebra 1 learning platform for students in grades 7-10.
            This policy explains what we collect, why, and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Account info</strong>, your email and a display name, if you create an account.</li>
            <li><strong>Learning progress</strong>, skills completed, practice results, XP, and Bridgeys. Without an account this stays only in your browser.</li>
            <li><strong>Profile</strong>, an optional photo and bio (tutors and students).</li>
            <li><strong>Messages &amp; calls</strong>, direct messages, group messages, and call records (including any AI-generated recap) so the feature works.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">What we do NOT do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>We do not sell your data.</li>
            <li>We do not show third-party ads.</li>
            <li>We do not record your video calls; video and audio are peer-to-peer and not stored.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">How your data is protected</h2>
          <p className="mt-2">
            Accounts and data are stored with Supabase (Postgres) and protected by
            row-level security, so you can only read your own data (and, for tutors and
            teachers, the students they work with). Passwords are hashed and never visible to us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Your choices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You can use AlgeBridge without an account (progress stays in your browser).</li>
            <li>You can <strong>delete your account and all associated data</strong> at any time from your profile.</li>
            <li>You can edit or remove your profile photo and bio whenever you like.</li>
          </ul>
        </section>

        <section id="extension">
          <h2 className="text-lg font-bold text-slate-900">AlgeBridge Hints browser extension</h2>
          <p className="mt-2">
            AlgeBridge Hints is our Chrome extension. It spots Algebra 1 and Algebra 2 problems
            on the pages you visit and gives step by step hints, never the answer. It works
            without an account.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Reading the page</strong>, the extension looks for math on the page you have open, right on your computer. Nothing from the page is sent just because you opened it.</li>
            <li><strong>When you ask for a hint</strong>, check an answer, or ask a question, it sends AlgeBridge only that one problem (up to 600 characters), the hints you have already seen for it, the answer or question you typed, if any, and which kind of help you asked for. It also sends back a sealed note our server made for that problem on your last hint, which only our server can open. Nothing else from the page goes with it: no page address, no browsing history, no cookies, and no AlgeBridge login. The text is processed by the AI service we use (Groq, with OpenAI as a backup) to write your hint. We do not log or save it.</li>
            <li><strong>A random install ID</strong>, made when you add the extension, goes with each request. It is not linked to your name, email, or AlgeBridge account. Our server holds it, your internet address, and a scrambled fingerprint of the problem only in memory, to count requests over the last 10 minutes so no one can ask for too many hints or answer checks in a short time. We do not save them to a database.</li>
            <li><strong>Settings and counts</strong>, your on or off choice, how problems are shown, and any sites you paused are saved in Chrome&apos;s extension storage (and synced to your Chrome profile if you use Chrome sync). Today&apos;s count of problems spotted and hints used stays on your device.</li>
          </ul>
          <p className="mt-2">
            The extension has no ads and does not collect your browsing history. When you pause it on a
            site or turn it off from its toolbar button, it sends nothing from those pages. Removing it
            from Chrome clears its settings and counts from your browser.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Children&apos;s privacy</h2>
          <p className="mt-2">
            AlgeBridge is intended for students in grades 7-10. If you are under 13, please
            use AlgeBridge with a parent, guardian, or teacher, and only create an account
            with their permission.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Contact</h2>
          <p className="mt-2">
            Questions? Email <a className="text-bridge-600 underline" href="mailto:support@algebridge.org">support@algebridge.org</a>.
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-3 text-sm">
        <Link href="/terms" className="btn-secondary">Terms of Service</Link>
        <Link href="/safety" className="btn-secondary">Safety &amp; Trust</Link>
        <Link href="/" className="btn-secondary">Back to Course</Link>
      </div>
    </article>
  );
}
