import Link from "next/link";

export const metadata = { title: "Privacy Policy — AlgeBridge" };

export default function PrivacyPage() {
  return (
    <article className="prose-slate mx-auto max-w-2xl">
      <h1 className="font-display text-3xl tracking-wide text-slate-900">Privacy Policy</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: July 2026</p>

      <div className="mt-6 space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Who we are</h2>
          <p className="mt-2">
            AlgeBridge is a free Algebra 1 learning platform for students in grades 7–10.
            This policy explains what we collect, why, and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Account info</strong> — your email and a display name, if you create an account.</li>
            <li><strong>Learning progress</strong> — skills completed, practice results, XP, and Bridgeys. Without an account this stays only in your browser.</li>
            <li><strong>Profile</strong> — an optional photo and bio (tutors and students).</li>
            <li><strong>Messages &amp; calls</strong> — direct messages, group messages, and call records (including any AI-generated recap) so the feature works.</li>
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

        <section>
          <h2 className="text-lg font-bold text-slate-900">Children&apos;s privacy</h2>
          <p className="mt-2">
            AlgeBridge is intended for students in grades 7–10. If you are under 13, please
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
