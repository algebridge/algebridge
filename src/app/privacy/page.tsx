import Link from "next/link";
import { PENDING_SAFETY_UPDATE } from "@/lib/safety";
import { GA_ID } from "@/lib/analytics";

export const metadata = { title: "Privacy Policy" };

/** The index under the title: each section's id and its heading. */
const SECTIONS: [string, string][] = [
  ["who-we-are", "Who we are"],
  ["what-we-collect", "What we collect"],
  ["what-we-do-not-do", "What we do not do"],
  ["who-can-see", "Who can see your data"],
  ["services", "Services that process your data"],
  ["your-choices", "Your choices"],
  ["safety-update", "Safety changes waiting on a database update"],
  ["extension", "AlgeBridge Hints browser extension"],
  ["childrens-privacy", "Children's privacy"],
  ["contact", "Contact"],
];

export default function PrivacyPage() {
  return (
    <article className="prose-slate mx-auto max-w-2xl">
      <h1 className="page-title">Privacy Policy</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: October 2026</p>

      {/* Ten sections over several screens: an index, so a parent or a
          district reviewer can go straight to the part they need. */}
      <nav aria-label="On this page" className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="eyebrow">On this page</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-block py-0.5 font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 space-y-6 text-slate-700">
        <section id="who-we-are" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Who we are</h2>
          <p className="mt-2">
            AlgeBridge is a free course in core Algebra 1 skills for students in grades 7 to 10,
            at learn.algebridge.org. This policy explains what we collect, why, who processes it,
            and the choices you have. It describes what the app does today, including what it
            does not do yet.
          </p>
        </section>

        <section id="what-we-collect" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Account info</strong>: your email, your real first and last name, and your role (student, teacher or tutor). If you sign up with a password, it is stored hashed by our sign-in service, Supabase, and nobody at AlgeBridge can read it. If you sign in with Google, Google gives us your name and email.</li>
            <li><strong>Learning progress</strong>: skills completed, practice results, XP, Bridgeys, streaks, the interests you pick or describe, and your notebook. It is saved to your account, and the teacher of any class you are in can read it.</li>
            <li><strong>Profile</strong>: an optional photo and bio. Photos are stored at a public link, so anyone who has a photo&apos;s link can open it. (This changes with the database update below.) A bio with a phone number, email address or social media username is not saved.</li>
            <li><strong>Messages and calls</strong>: direct messages, group messages, requests for help from a tutor, and call records, including the text recap written after a call.</li>
            <li><strong>Leaderboard</strong>: off unless you turn it on. If you tick &quot;Show me on the board&quot; on the leaderboard page, your first name and last initial, Bridgeys, skills finished and best house piece are shown to every signed-in AlgeBridge user. Untick it to come off. A student who was shown under the old default and has not signed in since stays on the board until the database update below.</li>
            <li><strong>Visit counts</strong>: AlgeBridge counts visits to algebridge.org and to this site as daily totals: the page, with any account, group or call id taken out, the site that linked to it, and whether it was a phone, tablet or computer. A random code your browser makes fresh each day lets one visit count once that day. It is never tied to your account, name, email or IP address, and the next day a new one replaces it. Admins, bots and browsers that send Global Privacy Control are left out, and only AlgeBridge admins see the totals.</li>
            <li><strong>Feedback</strong>: what you send through the feedback page, the page you sent it from, and a contact email (your account email unless you change it).</li>
            <li><strong>Reports</strong>: if you report someone, the reason you pick, any details you add, where it happened (the conversation, group or call), the account you reported, and which message you reported, if any. Reports are saved for an AlgeBridge admin to read and are not shown to the person reported. Reports wait in a list for an admin to read, and an alert for new ones is still to come, so a report is not read right away.</li>
            <li><strong>Blocks</strong>: the people you block are kept in your browser on that device, so that browser can hide them.</li>
          </ul>
        </section>

        <section id="what-we-do-not-do" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">What we do not do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>We do not sell your data.</li>
            <li>We do not show ads.</li>
            <li>We do not record video calls. Video and audio go straight between the two browsers and are not stored.</li>
          </ul>
        </section>

        <section id="who-can-see" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Who can see your data</h2>
          <p className="mt-2">
            Accounts and data are stored with Supabase (a Postgres database) and protected by
            row-level security, which decides what each account can read:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You can read your own records, tutor profiles (their email included), the leaderboard, and the members and messages of group chats you are in.</li>
            <li>The owner of a class can read the name, email and progress of each student on its roster, and can add a student who already has an account to a class by email, without the student being asked. Today the database does not check that a class&apos;s owner is a teacher account. (Both change with the database update below.)</li>
            <li>A tutor can read the name and email of every student, and every request for help. (This changes with the database update below.)</li>
            <li>AlgeBridge admins can read every profile.</li>
          </ul>
          <p className="mt-2">
            Teacher and tutor accounts need an access code from AlgeBridge. It is one shared code
            per role, not a personal invite.
          </p>
        </section>

        <section id="services" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Services that process your data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Supabase</strong> stores accounts, progress, messages and photos, and carries messages and call signals live.</li>
            <li><strong>Vercel</strong> hosts the website.</li>
            <li><strong>Groq, with OpenAI as a backup</strong>, writes three kinds of text. Archie, the study helper, gets the problem on screen with its hint and worked solution, the conversation, and the student&apos;s first name and picked interests, never a last name or email. Interests get only the words a student types about them; tapping a listed interest uses no AI. Word problems set in an interest get a problem the app made and the chosen topic. The Hints extension is described below.</li>
            <li><strong>Anthropic or OpenAI</strong>, when one is set up, writes the recap after a tutoring call. It gets both people&apos;s names, the call&apos;s captions as a transcript labeled by speaker (if captions were on), and the student&apos;s notebook. The recap is saved with the call record and sent to the other person as a message. Without either service, a template on our own server writes it.</li>
            <li><strong>Google</strong>: if anyone turns on captions in a call, the browser&apos;s speech recognition turns the audio into text, and in Chrome that is a Google service. Google also handles &quot;Continue with Google&quot; sign-in if you choose it.</li>
            <li><strong>YouTube</strong> plays the lesson videos, embedded from youtube-nocookie.com. Your browser contacts YouTube when a lesson&apos;s video player loads.</li>
            {GA_ID && (
              <li><strong>Google Analytics</strong> counts visits: which pages open, when, the browser and screen size, and a rough location worked out from the IP address, which Google does not keep. It sets a cookie with a random ID so one visitor over several days counts once. It gets no name, email, answer or message, the advertising features are off, and browsers that send Global Privacy Control are left out. Pages reach it with any account, group or call id taken out, and admins are left out. The demo frames on algebridge.org are counted there, not here.</li>
            )}
          </ul>
          <p className="mt-2">
            AlgeBridge checks each message to Archie, and each question to the Hints extension,
            against a list of phrases that suggest self-harm, abuse or danger: English, the common
            ways to say it in Spanish, Haitian Creole and Portuguese, the commonest phrasings in French,
            German, Italian, Polish and Vietnamese, and a few phrases in Chinese, Arabic, Russian,
            Ukrainian, Korean and Hindi. Archie also reads a student&apos;s last two
            messages together. A match goes to no AI service, and the student gets fixed text: talk
            to a trusted adult or school counselor now, call or text 988 or text HOME to 741741
            (Crisis Text Line) from any phone, chat with 988 online, or call 911. On the site this
            shows as a card with those as buttons. Archie checks in the student&apos;s browser, so a
            match is not sent to our server, not saved into a tutor booking, and not sent to a tutor.
            The Hints extension&apos;s check runs on our server, so its words reach our server and
            stop there. A message the list misses goes to the AI service like any other, and the AI
            is told to send the student to a trusted adult. Nobody is alerted, and the message is
            not stored.
          </p>
        </section>

        <section id="your-choices" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Your choices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Lessons and practice need a free account, so your work saves and your teacher can see it. Pages that work without an account, like the games, keep what you do only in your browser.</li>
            <li>You can <strong>delete your account</strong> at any time from your account page. That deletes your profile, progress, notebook, class memberships, leaderboard entry, help requests, every direct message you sent or received, and the group chat messages you sent. It does not yet delete photos you uploaded (their links keep working), feedback or reports you sent (they keep the message and contact email, no longer linked to you), or call records (the time and recap stay, no longer linked to you). Email us to have those removed.</li>
            <li>You can change your profile photo and bio whenever you like. There is no button to remove a photo yet; email us and we will.</li>
            <li>The leaderboard is off for you until you turn it on, and one checkbox turns it off again.</li>
            <li>You can <strong>report</strong> any message, person, group or call, and <strong>block</strong> anyone you talk to. Blocking hides their messages, calls and unread messages in the browser where you block them; it does not yet reach your other devices.</li>
          </ul>
        </section>

        <section id="safety-update" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Safety changes waiting on a database update</h2>
          <p className="mt-2">
            These are written and tested, but they take effect only when our database update of
            October 2026 is applied. Until then, the rules above describe what happens.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {PENDING_SAFETY_UPDATE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section id="extension" className="scroll-mt-20">
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

        <section id="childrens-privacy" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Children&apos;s privacy</h2>
          <p className="mt-2">
            AlgeBridge is meant for students in grades 7 to 10. It does not ask for a birth date
            or age, and it does not record a parent&apos;s or school&apos;s consent. If you are under
            13, please use AlgeBridge with a parent, guardian, or teacher, and only create an
            account with their permission. A parent or guardian can email us to see or delete
            their child&apos;s data.
          </p>
        </section>

        <section id="contact" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-slate-900">Contact</h2>
          <p className="mt-2">
            Questions? Email <a className="text-bridge-600 underline" href="mailto:support@algebridge.org">support@algebridge.org</a>.
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-3 text-sm">
        <Link href="/terms" className="btn-secondary">Terms of Service</Link>
        <Link href="/safety" className="btn-secondary">Safety &amp; Trust</Link>
        <Link href="/" className="btn-secondary">Back to the course</Link>
      </div>
    </article>
  );
}
