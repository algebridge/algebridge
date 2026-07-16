import Link from "next/link";

export const metadata = { title: "Terms of Service — AlgeBridge" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl tracking-wide text-slate-900">Terms of Service</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: July 2026</p>

      <div className="mt-6 space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Using AlgeBridge</h2>
          <p className="mt-2">
            AlgeBridge is provided free of charge for educational use. By using it, you agree
            to use it respectfully and lawfully, and not to misuse the messaging, group, or
            video-call features.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Accounts &amp; roles</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You are responsible for your account and for keeping your password secure.</li>
            <li><strong>Teacher and tutor accounts require an access code.</strong> Do not request or use one unless you are genuinely a teacher or tutor.</li>
            <li>We may remove accounts that abuse the platform or other users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Community conduct</h2>
          <p className="mt-2">
            Be kind. Messages, group chats (AlgeGroups), and calls exist to help students learn.
            Harassment, bullying, inappropriate content, or sharing others&apos; personal
            information is not allowed and may result in removal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Educational content</h2>
          <p className="mt-2">
            Lessons, hints, and AI-generated call recaps are provided to help you learn but
            may contain errors. Always double-check important work.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">No warranty</h2>
          <p className="mt-2">
            AlgeBridge is provided &quot;as is,&quot; without warranties. We work hard to keep it
            reliable, but we can&apos;t guarantee it will always be available or error-free.
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-3 text-sm">
        <Link href="/privacy" className="btn-secondary">Privacy Policy</Link>
        <Link href="/safety" className="btn-secondary">Safety &amp; Trust</Link>
        <Link href="/" className="btn-secondary">Back to Course</Link>
      </div>
    </article>
  );
}
