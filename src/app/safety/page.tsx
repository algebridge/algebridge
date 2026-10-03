import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { PENDING_SAFETY_UPDATE } from "@/lib/safety";

export const metadata = { title: "Safety & Trust" };

export default function SafetyPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="page-title">Safety &amp; Trust</h1>
      <p className="mt-2 text-slate-600">
        AlgeBridge lets students message and video-call tutors. Here is exactly what the app
        allows today, and what it does not do yet.
      </p>

      {/* One column, icon to the left: these are long paragraphs, read in
          order by a parent or a district reviewer, not a grid to scan. */}
      <div className="mt-6 grid gap-4">
        {([
          { e: "lock", t: "Who can see your data", d: "Row-level security decides what each account can read. A student reads their own records, tutor profiles (email included, until the database update below), the leaderboard and the group chats they are in. A class's owner sees the name, email and progress of the students on its roster, and a tutor can see every student's name and email (both change with the update below). Passwords are hashed and never visible to us." },
          { e: "shield", t: "Staff accounts need a code", d: "Tutor and teacher accounts need an access code from AlgeBridge. It is one shared code per role, not a personal invite, and it is the only check the app makes before an account becomes staff." },
          { e: "messages", t: "Messages", d: "A student can send direct messages only to a tutor, teacher or AlgeBridge admin, never to another student, and the database enforces it. Group chats are started by a tutor, who picks the students. Leaving a group chat waits on the database update below." },
          { e: "shield", wide: true, t: "Personal information stays out", d: "Before a direct or group message is sent, the AlgeBridge app reads it, together with the sender's last few messages there, for phone numbers, email addresses, home addresses, social media usernames, links to other sites, plans to talk somewhere else, questions like \"what school do you go to\", and requests to keep a chat secret. A student's message with any of these is not sent, and the student is told why. A tutor or teacher is warned and can still send it, except a request for secrecy, which the app does not send. The same check runs on answers in Archie's Book a tutor form and on profile bios. It runs in the app, so a program that writes to the database directly skips it; the database's own check (after the update below) covers phone numbers and email addresses only." },
          { e: "phone", t: "Calls", d: "In the app, only a tutor or an AlgeBridge admin can start a video call, and only with a student. It rings only if the student is online and the caller has a tutor, teacher or admin account, and they can decline. The ring shows the caller's name from their profile. Video and audio are never recorded. The database is looser than the app: it also accepts a ring from a student to a tutor or teacher." },
          { e: "helper", wide: true, t: "If a student is in danger", d: "Each message to Archie and to the Hints extension is checked against a list of phrases that suggest self-harm, abuse or danger: English, the common ways to say it in Spanish, Haitian Creole and Portuguese, the commonest phrasings in French, German, Italian, Polish and Vietnamese, and a few phrases in Chinese, Arabic, Russian, Ukrainian, Korean and Hindi. Archie reads a student's last two messages together, so a sentence split in two counts. A match goes to no AI service, and the student gets a calm card: talk to a trusted adult or school counselor now, call or text 988 or text HOME to 741741 from any phone, chat with 988 online from a computer, 988's Spanish line, and 911 in danger. Archie checks in the browser, so a match is not sent anywhere, saved into a booking or sent to a tutor; the extension checks on AlgeBridge's server, where the words stop. A message the list misses goes to the AI, which is told to send the student to a trusted adult (the extension's AI is also told to answer with a signal that shows the same card). Words typed into a report are checked too, and the report is still saved. Nobody is alerted automatically." },
          { e: "trash", t: "Deleting an account", d: "Delete your account from your account page. That removes your profile, progress, notebook, direct messages and the group messages you sent. Photos you uploaded, feedback and reports you sent and call recaps are not removed with it yet; email us and we will remove them." },
          { e: "leaderboard", t: "Leaderboard, off by default", d: "In the app, a student is on the leaderboard only after they tick \"Show me on the board\". Then it shows a first name and last initial to every signed-in AlgeBridge user, and one click takes them off again. Students who were shown under the old default and have not signed in since stay on it until the database update below." },
          { e: "school", t: "School mode", d: "A school can run AlgeBridge with direct messages, group chats, video calls, the tutor directory and booking, the tutors' workspace, the leaderboard and the team games turned off. Their pages show \"Turned off for school accounts\" instead. A few links to them still appear (on lessons, in the account menu, and on the profile, sign-in and Bridgey House pages) and lead to that notice. Lessons, practice and Archie stay. The For schools page lists exactly what the switch does." },
          { e: "eye-off", t: "No ads, no selling data", d: "AlgeBridge is free, shows no ads, and does not sell your information." },
          { e: "flag", t: "Report and block", d: "Every message in a direct or group chat, every call, every conversation and every group has a Report button. A report saves the reason, the place and which message was reported, for an AlgeBridge admin to read, and the person is not told who reported. Reports wait in a list for an admin to read, and an alert for new ones is still to come, so a report is not read right away: a student in danger should tell a trusted adult or call 911. Block hides someone's messages, calls and unread count in the browser where you block them; it reaches your other devices only after the database update below. An AlgeBridge admin can remove an account." },
        ] satisfies { e: IconName; t: string; d: string; wide?: boolean }[]).map((c) => (
          <div key={c.t} className="card flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bridge-50 text-bridge-600 ring-1 ring-inset ring-bridge-100" aria-hidden>
              <Icon name={c.e} size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900">{c.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.d}</p>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="safety-update" className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <h2 id="safety-update" className="font-bold text-slate-900">Waiting on a database update</h2>
        <p className="mt-1 text-sm text-slate-700">
          Written and tested, and in effect only once our October 2026 database update is applied:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {PENDING_SAFETY_UPDATE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

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
