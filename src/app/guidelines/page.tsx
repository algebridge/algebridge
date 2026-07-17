import Link from "next/link";

export const metadata = { title: "Community Guidelines — AlgeBridge" };

export default function GuidelinesPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl tracking-wide text-slate-900">Community Guidelines</h1>
      <p className="mt-3 text-slate-700">
        Hey — welcome to the AlgeBridge community. 👋 We&apos;re students who built this because we
        remember exactly how it felt when Algebra 1 stopped making sense. This is a place to ask
        questions without feeling dumb, help each other out, and actually get it. Here&apos;s the
        short version of how we keep it that way.
      </p>

      <div className="mt-8 space-y-7 text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Be cool to each other</h2>
          <p className="mt-2">
            Everyone here is still learning — that&apos;s literally the point. So no putting people
            down, no mean comments, no making someone feel small for not getting something yet. If a
            tutor explained it three times and it still isn&apos;t clicking, that&apos;s normal.
            Ask again. And if you&apos;re the one helping, be the person you wish you&apos;d had.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Keep it about the math</h2>
          <p className="mt-2">
            Messages, AlgeGroups, and calls are here to help you learn Algebra 1 — not for spam,
            ads, or random off-topic stuff. It&apos;s totally fine to be friendly and joke around;
            just keep the group focused enough that people can actually get help.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Guard your privacy (and everyone else&apos;s)</h2>
          <p className="mt-2">
            Please don&apos;t share personal stuff like your address, phone number, passwords, or
            anything to do with money — and never share someone else&apos;s. If a tutor or another
            student ever asks you to move the conversation somewhere else, off AlgeBridge, that&apos;s
            a red flag. Keep it here where it&apos;s safe.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Keep it appropriate</h2>
          <p className="mt-2">
            Lots of the people here are in grades 7–10, so nothing sexual, violent, hateful, or
            otherwise not-okay in chats, groups, or on calls. Pretty simple — if you wouldn&apos;t
            say it in a classroom, don&apos;t say it here.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">If you&apos;re a tutor</h2>
          <p className="mt-2">
            Thank you, seriously — you&apos;re the reason this works. A few things we ask: help
            students actually <em>understand</em> the problem instead of just handing over the
            answer, be patient and encouraging, only hop on a call with someone who wants the help,
            and wrap it up kindly when you&apos;re done. And never ask a student for money, contact
            info, or anything in return. You&apos;re here to help, full stop.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">If you&apos;re a student</h2>
          <p className="mt-2">
            Ask away — there&apos;s no such thing as a question that&apos;s too basic here, and the
            people helping you were stuck on the same stuff not long ago. You never have to share
            personal details, and you can turn down or leave any call, no explanation needed. If
            something ever feels off or makes you uncomfortable, tell a parent or teacher you trust,
            and let us know too.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">If something goes wrong</h2>
          <p className="mt-2">
            Nobody&apos;s perfect, but if someone&apos;s breaking these — being cruel, sharing bad
            stuff, or making people feel unsafe — tell us at{" "}
            <a className="text-bridge-600 underline" href="mailto:support@algebridge.org">
              support@algebridge.org
            </a>{" "}
            with what happened. We read every report. Depending on how serious it is, we&apos;ll
            give a warning or remove the account for good — and anything about someone&apos;s safety,
            we take seriously, every time.
          </p>
        </section>

        <p className="rounded-xl bg-bridge-50 p-4 text-sm text-bridge-900">
          That&apos;s it. Be kind, stay curious, and help each other cross the bridge. 🌉
        </p>
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
