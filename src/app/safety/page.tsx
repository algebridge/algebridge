import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

export const metadata = { title: "Safety & Trust, AlgeBridge" };

export default function SafetyPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="page-title">Safety &amp; Trust</h1>
      <p className="mt-2 text-slate-600">
        AlgeBridge connects students with real tutors, so we take safety seriously.
        Here&apos;s how we keep the platform trustworthy.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {([
          { e: "lock", t: "Protected accounts", d: "Row-level security means you can only ever see your own data. Passwords are hashed and never visible to us." },
          { e: "shield", t: "Verified tutors", d: "Tutor and teacher accounts require an access code, so students aren't messaged by anyone posing as staff." },
          { e: "phone", t: "You control calls", d: "Only tutors can start a call, and it only rings if you're online. You can decline any call, and video is never recorded." },
          { e: "trash", t: "Delete anytime", d: "You can permanently delete your account and all your data from your account settings." },
          { e: "eye-off", t: "No ads, no selling data", d: "AlgeBridge is free and does not sell your information or show third-party ads." },
          { e: "flag", t: "Report problems", d: "See something wrong? Email us and we'll act on it. Abusive accounts are removed." },
        ] satisfies { e: IconName; t: string; d: string }[]).map((c) => (
          <div key={c.t} className="card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bridge-50 text-bridge-600 ring-1 ring-inset ring-bridge-100" aria-hidden>
              <Icon name={c.e} size={20} />
            </span>
            <h2 className="mt-2 font-bold text-slate-900">{c.t}</h2>
            <p className="mt-1 text-sm text-slate-600">{c.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-bridge-50 p-4 text-sm text-bridge-900">
        Need help or want to report something? Email{" "}
        <a className="font-semibold underline" href="mailto:support@algebridge.org">
          support@algebridge.org
        </a>.
      </div>

      <div className="mt-8 flex gap-3 text-sm">
        <Link href="/privacy" className="btn-secondary">Privacy Policy</Link>
        <Link href="/terms" className="btn-secondary">Terms of Service</Link>
        <Link href="/" className="btn-secondary">Back to the course</Link>
      </div>
    </article>
  );
}
