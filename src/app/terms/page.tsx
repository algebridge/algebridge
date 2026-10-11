import Link from "next/link";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="page-title">Terms of Service</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: October 2026</p>

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
            <li>Lessons and practice need a free account, under your real first and last name.</li>
            <li>If you are under 13, create an account only with a parent&apos;s, guardian&apos;s or teacher&apos;s permission.</li>
            <li>You are responsible for your account and for keeping your password secure.</li>
            <li><strong>Teacher and tutor accounts require an access code.</strong> Do not request or use one unless you are genuinely a teacher or tutor, and do not share it.</li>
            <li><strong>Leaderboard.</strong> By creating an account you agree that your first name, last initial, Bridgeys, skills finished and best house piece are shown on the leaderboard to signed-in AlgeBridge users, unless you turn it off on the leaderboard page. School accounts are not shown.</li>
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
            Lessons, hints, Archie&apos;s replies, word problems written by AI, and AI-written call
            recaps are provided to help you learn but may contain errors. Always double-check
            important work. Lesson videos come from public YouTube channels that are not
            affiliated with AlgeBridge.
          </p>
        </section>

        <section>
          <h2 id="contributions" className="scroll-mt-20 text-lg font-bold text-slate-900">Contributions</h2>
          <p className="mt-2">
            Algebridge is free to use. We accept voluntary contributions from supporters who want
            to help keep it that way. A contribution does not purchase any product, service,
            membership, or benefit, and it does not change anyone&apos;s access to Algebridge, which
            remains free for everyone.
          </p>
          <p className="mt-2">
            <strong>Who receives contributions.</strong> Algebridge is a student-led project and is
            not yet a registered nonprofit organization. Contributions are received by Mykola
            Dubovyi, an adult who manages Algebridge&apos;s finances on behalf of the project,
            because the members of the Algebridge team are under 18. Contributions are not
            tax-deductible.
          </p>
          <p className="mt-2">
            <strong>How contributions are used.</strong> Contributions are used only for the costs of
            running and growing Algebridge, including:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Platform and technology:</strong> website hosting, databases, domain names, AI services that power Archie (our study helper), developer accounts, error monitoring, and the software tools the team uses to build Algebridge.</li>
            <li><strong>Becoming a nonprofit:</strong> state incorporation fees, IRS filing fees for tax-exempt status, annual filings, and legal or compliance reviews, including a review of how we protect children&apos;s privacy online.</li>
            <li><strong>Administration:</strong> bookkeeping software, banking and payment processing fees, trademark registration, and a mailing address and phone line for the project.</li>
            <li><strong>Outreach:</strong> advertising, content creation and design tools, email newsletters, printed materials, and branded materials that help students and schools find Algebridge.</li>
            <li><strong>Student programs and events:</strong> event spaces, transportation to education events, food at events, conference and competition registration fees, and prizes for students who take part in Algebridge programs and challenges.</li>
          </ul>
          <p className="mt-2">
            We decide how to allocate contributions among these purposes based on the project&apos;s
            needs. We do not use contributions for anyone&apos;s personal expenses unrelated to
            Algebridge.
          </p>
          <p className="mt-2">
            <strong>When Algebridge becomes a nonprofit.</strong> We plan to register Algebridge as a
            nonprofit organization. When that happens, contributions that have not yet been spent
            will be transferred to the new organization and used for the same purposes.
            Contributions made before the organization is recognized as tax-exempt will remain
            non-deductible.
          </p>
          <p className="mt-2">
            <strong>Refunds.</strong> Contributions are voluntary and generally non-refundable. If you
            made a contribution by mistake or in the wrong amount, contact{" "}
            <a href="mailto:info@algebridge.org" className="underline">info@algebridge.org</a> within
            14 days and we will review your request.
          </p>
          <p className="mt-2">
            <strong>Questions.</strong> For any question about a contribution or a charge, write to{" "}
            <a href="mailto:info@algebridge.org" className="underline">info@algebridge.org</a>.
            Charges appear on card statements as ALGEBRIDGE.
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
        <Link href="/" className="btn-secondary">Back to the course</Link>
      </div>
    </article>
  );
}
