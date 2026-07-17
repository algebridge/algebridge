import Link from "next/link";

export const metadata = { title: "Community Guidelines — AlgeBridge" };

export default function GuidelinesPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl tracking-wide text-slate-900">Community Guidelines</h1>
      <p className="mt-2 text-slate-600">
        AlgeBridge connects students and tutors through messages, group chats (AlgeGroups),
        and video calls. These guidelines keep it a safe, kind, and focused place to learn.
        By using the community features, you agree to follow them.
      </p>

      <div className="mt-8 space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">1. Be respectful</h2>
          <p className="mt-2">
            Treat everyone with kindness and patience. No harassment, bullying, name-calling,
            threats, discrimination, or hate speech of any kind. Everyone here is learning.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">2. Keep it about the math</h2>
          <p className="mt-2">
            Messages, AlgeGroups, and calls are for learning Algebra 1 and supporting each other.
            Don&apos;t use them for spam, advertising, or off-topic content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">3. Protect privacy — yours and others&apos;</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Don&apos;t share personal information (home address, phone number, passwords, financial details).</li>
            <li>Never share someone else&apos;s private information or messages.</li>
            <li>Don&apos;t ask students or tutors to move the conversation off AlgeBridge.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">4. Nothing inappropriate</h2>
          <p className="mt-2">
            No sexual, violent, illegal, or otherwise inappropriate content in messages, group
            chats, or on video calls. AlgeBridge is used by students in grades 7–10.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">5. For tutors</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You&apos;re here to help students learn — be encouraging and professional.</li>
            <li>Guide students to understand concepts; help them, don&apos;t just hand over answers.</li>
            <li>Only start a call with a student who wants help, and end it respectfully.</li>
            <li>Never request personal contact info, money, or anything in return for help.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">6. For students</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Ask questions freely — no question is too small.</li>
            <li>You can decline or end any call, and you&apos;re never required to share personal details.</li>
            <li>Tell a trusted adult, or email us, if anything ever makes you uncomfortable.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">7. Reporting &amp; consequences</h2>
          <p className="mt-2">
            If someone breaks these guidelines, email{" "}
            <a className="text-bridge-600 underline" href="mailto:support@algebridge.org">
              support@algebridge.org
            </a>{" "}
            with the details. We review reports and may warn or permanently remove accounts that
            violate these rules. Serious safety concerns are always taken seriously.
          </p>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/safety" className="btn-secondary">Safety &amp; Trust</Link>
        <Link href="/privacy" className="btn-secondary">Privacy Policy</Link>
        <Link href="/terms" className="btn-secondary">Terms of Service</Link>
        <Link href="/" className="btn-secondary">Back to Course</Link>
      </div>
    </article>
  );
}
