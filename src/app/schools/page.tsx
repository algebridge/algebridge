import type { Metadata } from "next";
import Link from "next/link";
import "./schools.css";
import { units } from "@/data/curriculum";
import { skillOffersCalculator } from "@/data/problem-banks";
import {
  GRAPHING_STANDARDS,
  NOT_CLAIMED,
  SKILL_STANDARDS,
  citedStandards,
  levelLabel,
  type Standard,
} from "@/data/standards";
import { SKILL_VIDEOS } from "@/data/videos";
import { StandardsChip } from "@/components/StandardsChip";
import { Icon, type IconName } from "@/components/Icon";
import { PrintButton } from "./PrintButton";
import { PhoneFold, UnitStandards } from "./UnitStandards";
import { SchoolIcon, type SchoolIconName } from "./icons";
import { SCHOOL_MODE_OFF, SCHOOL_MODE_STAYS } from "@/lib/school-mode";
import { PENDING_SAFETY_UPDATE } from "@/lib/safety";
import { GA_ID } from "@/lib/analytics";

/*
 * A page for a school or district audience. Every sentence here was checked
 * against the code (Oct 2026): src/app/teacher, src/lib/teacher.ts,
 * src/lib/assignments.ts, src/lib/path.ts, src/lib/spaced-repetition.ts,
 * src/lib/diagnose.ts, src/app/api/* (helper, interests, personalize,
 * summary), src/lib/helper.ts (the crisis reply), src/lib/social.ts, the room
 * and messages pages, src/data/standards.ts and every supabase/*.sql policy.
 * Counts are computed from the data, never typed in. It says what AlgeBridge
 * does not do yet as plainly as what it does. If a feature changes, change
 * this page with it, and the version line at the bottom.
 */

export const metadata: Metadata = {
  title: "For schools",
  description:
    "AlgeBridge for schools and districts: free practice in core Algebra 1 skills for grades 7 to 10, what it covers and does not cover yet, teacher tools, Common Core alignment, and how student data is handled.",
};

/** The version printed at the foot of the handout. Change it when the page changes. */
const VERSION = "October 2026";
const CONTACT = "info@algebridge.org";
const PHONE = "302-345-7448";
const PHONE_HREF = "tel:+13023457448";

const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);
const CITED = citedStandards();
const HS_COUNT = CITED.filter((s) => s.level === "HS").length;
const MS_COUNT = CITED.length - HS_COUNT;
const MAPPED = units.flatMap((u) => u.skills).filter((s) => (SKILL_STANDARDS[s.id] ?? []).length > 0).length;
const CALC_SKILLS = units.flatMap((u) => u.skills).filter((s) => skillOffersCalculator(s.id, s.problems)).length;
const SKILL_TITLES: Record<string, string> = Object.fromEntries(units.flatMap((u) => u.skills.map((s) => [s.id, s.title])));
/** The YouTube channels the lesson videos come from, most used first. */
const CHANNELS = Object.entries(
  Object.values(SKILL_VIDEOS).reduce<Record<string, number>>((n, v) => ({ ...n, [v.channel]: (n[v.channel] ?? 0) + 1 }), {})
)
  .sort((a, b) => b[1] - a[1])
  .map(([channel]) => channel);
/** Standards left off because no item draws or reads a graph, each with the skills it would belong to. */
const GRAPH_LEFT_OFF = GRAPHING_STANDARDS.map((code) => ({
  code,
  skills: NOT_CLAIMED.filter((n) => n.code === code).map((n) => SKILL_TITLES[n.skillId]),
}));
const OTHER_LEFT_OFF = NOT_CLAIMED.filter((n) => !GRAPHING_STANDARDS.includes(n.code));
const UNMAPPED = TOTAL_SKILLS - MAPPED;

/**
 * Commonly taught Algebra 1 content the course does not have yet. Each code
 * was checked absent from SKILL_STANDARDS; the last two are gaps inside
 * skills the course does have.
 */
const NOT_COVERED: { what: string; codes?: string }[] = [
  { what: "Statistics: data displays, center and spread, scatter plots, correlation", codes: "HSS-ID" },
  { what: "Transforming functions, such as shifting or stretching a graph", codes: "HSF-BF.B.3" },
  { what: "Reading key features from graphs and tables, and comparing functions shown in different ways", codes: "HSF-IF.B.4, B.5, C.9" },
  { what: "Comparing linear and exponential models", codes: "HSF-LE.A.1.a, A.1.b, A.3, B.5" },
  { what: "Writing equations and inequalities from a situation", codes: "HSA-CED.A.1, A.2" },
  { what: "Interpreting the parts of an expression in context", codes: "HSA-SSE.A.1" },
  { what: "Using a polynomial's zeros to sketch its graph", codes: "HSA-APR.B.3" },
  { what: "Sums and products of rational and irrational numbers", codes: "HSN-RN.B.3" },
  { what: "Any graphing: no practice item draws a graph or asks a student to read one" },
  { what: "Quadratic equations with irrational roots: every quadratic a student solves in practice has whole-number roots" },
];

type Glyph = { icon: IconName } | { glyph: SchoolIconName };

interface Item {
  title: string;
  body: React.ReactNode;
  mark: Glyph;
}

function Mark({ mark, tone = "brand" }: { mark: Glyph; tone?: "brand" | "slate" }) {
  return (
    <span
      className={`schools-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        tone === "brand" ? "bg-bridge-50 text-bridge-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {"icon" in mark ? <Icon name={mark.icon} size={18} /> : <SchoolIcon name={mark.glyph} size={18} />}
    </span>
  );
}

function Section({
  id,
  n,
  title,
  intro,
  children,
}: {
  id: string;
  n: number;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="schools-section scroll-mt-24">
      <div className="flex items-baseline gap-3">
        <span className="schools-num font-display text-lg leading-none text-bridge-600" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">
          {title}
        </h2>
      </div>
      {intro && <p className="schools-intro mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ItemGrid({ items, cols = 2 }: { items: Item[]; cols?: 2 | 3 }) {
  return (
    <ul className={`schools-grid grid gap-3 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((item) => (
        <li key={item.title} className="schools-card flex gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
          <Mark mark={item.mark} />
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">{item.title}</h3>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Watch",
    body: `A video picked for the skill from a public YouTube math channel: ${CHANNELS.slice(0, 2).join(", ")} and ${CHANNELS.length - 2} others. None is affiliated with AlgeBridge.`,
  },
  {
    n: "2",
    title: "Practice",
    body: "New numbers every session. Five right answers on the first try finish the skill. A right answer on a retry does not count.",
  },
  {
    n: "3",
    title: "Get feedback",
    body: "A wrong answer gets a note naming the likely slip, like a sign error, without giving the answer away. After two tries, the worked steps can be opened, and that problem does not count.",
  },
  {
    n: "4",
    title: "Review",
    body: "Finished skills come back for a quick check 1, 3, 7, 14 and 30 days later.",
  },
];

const STUDENT_EXTRAS: Item[] = [
  {
    mark: { icon: "lock" },
    title: "Skills open in order",
    body: "Like levels: finishing a skill opens the next. A student who already knows a skill can pass Show what you know, three right in a row, to move ahead. Assigning a skill opens it for the class.",
  },
  {
    mark: { icon: "helper" },
    title: "Archie, an AI study helper",
    body: "Gives a hint, a first step, the key idea, a similar example, or a check of the student's work, and says it is an AI. It never gives the final answer: asking for it is refused before any AI model sees the request, and a reply that contains it is thrown away.",
  },
  {
    mark: { icon: "star" },
    title: "Word problems about their interests",
    body: "Students can pick interests, such as a sport or a hobby, and some practice problems are then set in them. The math and the answer key stay the same.",
  },
  {
    mark: { glyph: "calculator" },
    title: "A calculator only where it fits",
    body: `An on-screen calculator appears in the ${CALC_SKILLS} skills where the numbers call for one, such as unit conversions and compound interest, and stays out of the rest.`,
  },
];

const TEACHER_ITEMS: Item[] = [
  {
    mark: { icon: "classes" },
    title: "Classes",
    body: "Create a class with a name, period and grade level. Archive it at the end of the term without losing anything, or delete it.",
  },
  {
    mark: { icon: "students" },
    title: "Rosters",
    body: "Students join with the class's 6-character code. Or paste a column of school emails from a gradebook: each student needs an AlgeBridge account first, and is added without being asked.",
  },
  {
    mark: { icon: "course" },
    title: "Progress",
    body: `For each student: skills finished out of ${TOTAL_SKILLS}, level, streak, problems solved, and when they were last active. Sort the roster by name, progress or last activity.`,
  },
  {
    mark: { icon: "check" },
    title: "Assignments",
    body: "Assign one skill or a whole unit, with an optional due date and a note. Students see the list in your order on their dashboard, and you see how many have finished each one.",
  },
];

const PRIVACY_ITEMS: Item[] = [
  {
    mark: { glyph: "id-card" },
    title: "Real names",
    body: "Accounts use a real first and last name so teachers can find students on a roster. A last initial alone is not accepted.",
  },
  {
    mark: { icon: "lock" },
    title: "Who can see what",
    body: "The database uses row-level security. A student reads their own records, tutor profiles (email included), the leaderboard and the group chats they are in. The owner of a class sees the names, emails and progress of the students on its roster; today the database does not check that the owner is a teacher account, and a teacher can add a student by email without asking them. A tutor can see every student's name and email. All of these change with the database update below. Staff accounts need one shared access code per role.",
  },
  {
    mark: { icon: "messages" },
    title: "Students only message staff",
    body: "A student cannot send a direct message to another student: every direct message has a tutor, teacher or AlgeBridge admin on one end, and the database enforces it. Group chats are started by a tutor, who picks the students. Before any message is sent, the app reads it with the sender's last few messages and holds back a student's message with a phone number, email, home address, username, link, plan to talk somewhere else or request for secrecy, and says why; staff are warned and may send it, except a request for secrecy, which the app does not send. The same check covers Book a tutor answers and profile bios. These checks run in the app, so a program writing to the database directly skips them; after the update below the database itself refuses phone numbers and email addresses.",
  },
  {
    mark: { icon: "flag" },
    title: "Report and block",
    body: "Every message in a direct or group chat, every call, every conversation and every group has a Report button. A report saves the reason, the place, the reported account and which message was reported, for an AlgeBridge admin to read; the person reported is not told who sent it. Reports wait in a list for an admin to read, and an alert for new ones is still to come, so a report is not read right away. Block hides that person's messages, calls and unread count in the browser where the student blocks them.",
  },
  {
    mark: { glyph: "video" },
    title: "Calls, not recorded",
    body: "In the app only a tutor or an AlgeBridge admin can start a video call, and only with a student, on a channel only those two can join. A ring sounds only when the caller has a tutor, teacher or admin account, and shows the caller's name from their profile. Video and audio go straight between the two browsers and are not recorded. The database's ringing rule is looser: it also lets a student ring a tutor or teacher.",
  },
  {
    mark: { icon: "leaderboard" },
    title: "Leaderboard, off by default",
    body: "In the app no student is on it until they tick \"Show me on the board\". Then it shows their first name, last initial, Bridgeys, skills finished and best house piece to every signed-in AlgeBridge user, not only classmates. Students shown under the old default who have not signed in since stay on it until the database update below.",
  },
  {
    mark: { glyph: "no-ads" },
    title: "No ads, and deleting an account",
    body: "No ads, and student data is not sold. Deleting an account from its account page removes the profile, progress, notebook, class places, leaderboard row, and its direct and group messages. Uploaded photos (stored at public links), feedback and reports with their contact email, and call records with their recaps are not deleted with it yet; email us to remove them.",
  },
  {
    mark: { icon: "eye" },
    title: "Visit counts",
    body:
      "AlgeBridge counts page views itself as daily totals: the page with any account, group or call id taken out, the site that linked to it, and phone, tablet or computer. A random code the browser makes fresh each day lets one visit count once that day; it is never tied to an account, name, email or IP address. Admins, bots and browsers that send Global Privacy Control are left out, and only AlgeBridge admins see the totals." +
      // Named only while a measurement ID is set, so the handout matches the running deployment.
      (GA_ID
        ? " Google Analytics also counts page views on the live site, with the same pages and the same people left out, plus the browser, screen size and a rough location from the IP address, which Google does not keep. Its advertising features are off. A district deployment runs without it when NEXT_PUBLIC_GA_ID is set to an empty value."
        : ""),
  },
];

const AI_ROWS: { what: string; sends: string; who: string }[] = [
  {
    what: "Archie, the study helper",
    sends: "The problem on screen with its hint and worked solution, the conversation, and the student's first name and picked interests. Not their last name or email.",
    who: "Groq, with OpenAI as a backup. If neither answers, a built-in engine on AlgeBridge's own server replies.",
  },
  {
    what: "Interests",
    sends: "Only words a student types about their interests, never a name, email or account id. Tapping a listed interest uses no AI at all.",
    who: "Groq, with OpenAI as a backup.",
  },
  {
    what: "Word problems in a student's interests",
    sends: "A problem the app generated and the chosen topic. Stored stories are used first; the AI writes one only for a problem shape it has not seen.",
    who: "Groq, with OpenAI as a backup.",
  },
  {
    what: "Live captions in a call",
    sends: "The call's audio, only while someone has captions turned on.",
    who: "The browser's own speech recognition: in Chrome, a Google service.",
  },
  {
    what: "Call recaps",
    sends: "Both people's names, the captions (if they were on) as a transcript with each line labeled by speaker, and the student's notebook. The recap is saved with the call record and sent to the other person as a message.",
    who: "Anthropic (Claude) or OpenAI when one is configured; otherwise a template on AlgeBridge's own server.",
  },
];

const ACCESS_ITEMS: Item[] = [
  {
    mark: { glyph: "keyboard" },
    title: "Keyboard",
    body: "Practice works without a mouse: Enter checks an answer and moves on, and the keys 1 to 9 pick a multiple-choice answer. Buttons and links show a focus ring when reached by keyboard.",
  },
  {
    mark: { glyph: "screen-reader" },
    title: "Screen readers",
    body: "Buttons that show only an icon carry a text label, and Archie's replies are marked as a conversation log so they are read as they arrive.",
  },
  {
    mark: { icon: "speaker" },
    title: "Read aloud",
    body: "A speaker button reads any practice problem aloud with the device's built-in voice, which helps students who read slowly or are learning English.",
  },
  {
    mark: { glyph: "motion" },
    title: "Reduced motion",
    body: "When a device is set to reduce motion, AlgeBridge turns its animations and transitions off.",
  },
];

/** The cited standards grouped for the key: high school by domain, then grades 6 to 8. */
function keyGroups(): { title: string; items: Standard[] }[] {
  const groups: { title: string; items: Standard[] }[] = [];
  for (const s of CITED) {
    const title = s.level === "HS" ? `High school: ${s.domain}` : `${levelLabel(s.level)}: ${s.domain}`;
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(s);
    else groups.push({ title, items: [s] });
  }
  return groups;
}

export default function SchoolsPage() {
  return (
    <article className="schools-page mx-auto max-w-5xl">
      {/* ---- Opening ---------------------------------------------------- */}
      <div className="schools-hero relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-panel sm:px-8 sm:py-9">
        <div className="schools-hero-rule absolute inset-x-0 top-0 h-1 bg-bridge-600" aria-hidden="true" />
        <p className="eyebrow text-bridge-700">For schools and districts</p>
        <h1 className="mt-2 font-display text-[34px] font-normal leading-[1.05] tracking-[0.01em] text-slate-900 sm:text-[44px]">
          AlgeBridge for schools
        </h1>
        <p className="schools-lead mt-3 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-[17px]">
          Free practice in core Algebra 1 skills for grades 7 to 10, in a web browser with nothing to install. Below:
          what students do, what the course covers and does not cover yet, what teachers get, how it lines up with
          the Common Core standards Delaware uses, and how student data is handled. Everything here describes
          AlgeBridge as it works today, including what it does not do yet.
        </p>
        <div className="schools-actions mt-5 flex flex-wrap gap-3 print:hidden">
          <PrintButton />
          <a href={`mailto:${CONTACT}`} className="btn-secondary">
            <SchoolIcon name="mail" size={16} />
            {CONTACT}
          </a>
          <a href={PHONE_HREF} className="btn-secondary">
            <Icon name="phone" size={16} />
            {PHONE}
          </a>
        </div>

        <dl className="schools-facts mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {[
            { k: "Cost", v: "Free", d: "No ads, no paid version" },
            { k: "Course", v: `${units.length} units`, d: `${TOTAL_SKILLS} skills, grades 7 to 10` },
            { k: "Standards", v: `${CITED.length} CCSS-M codes`, d: MAPPED === TOTAL_SKILLS ? `All ${TOTAL_SKILLS} skills mapped` : `${MAPPED} of ${TOTAL_SKILLS} skills mapped` },
            { k: "Setup", v: "A web browser", d: "Sign in with email or Google" },
          ].map((f) => (
            <div key={f.k} className="bg-white px-4 py-3.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{f.k}</dt>
              <dd className="mt-1 text-lg font-semibold leading-tight text-slate-900">{f.v}</dd>
              <dd className="mt-0.5 text-xs text-slate-500">{f.d}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-label="On this page" className="schools-toc mt-5 print:hidden">
        <ul className="flex flex-wrap gap-2 text-sm">
          {[
            ["students", "Students"],
            ["teachers", "Teachers"],
            ["standards", "Standards"],
            ["privacy", "Privacy and safety"],
            ["accessibility", "Accessibility"],
            ["contact", "Cost and contact"],
          ].map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition-colors hover:border-bridge-300 hover:text-bridge-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="schools-body mt-10 space-y-14">
        {/* ---- 1. Students ---------------------------------------------- */}
        <Section
          id="students"
          n={1}
          title="What students do"
          intro={`The course runs from units and conversions to quadratics, absolute value and piecewise functions: ${units.length} units and ${TOTAL_SKILLS} skills. Every skill follows the same four steps.`}
        >
          <ol className="schools-steps grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="schools-card rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bridge-600 text-xs font-bold text-white">
                    {s.n}
                  </span>
                  <h3 className="text-[15px] font-semibold text-slate-900">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <ItemGrid items={STUDENT_EXTRAS} />
          </div>

          {/* What is in the course, and what a district would expect that is not there yet. */}
          <div className="schools-coverage mt-3 grid gap-3 md:grid-cols-[1fr_1.35fr]">
            <div className="schools-card rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
              <h3 className="text-[15px] font-semibold text-slate-900">What the course covers</h3>
              <ol className="mt-2 space-y-0.5 text-sm leading-relaxed text-slate-600">
                {units.map((u) => (
                  <li key={u.id}>
                    <span className="tabular-nums text-slate-400">{u.number}.</span> {u.title}
                  </li>
                ))}
              </ol>
            </div>
            <div className="schools-card rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <h3 className="text-[15px] font-semibold text-slate-900">Not covered yet</h3>
              <p className="mt-1 text-sm text-slate-600">
                Commonly taught in Algebra 1, and not in AlgeBridge today. A class using it needs another source for:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-snug text-slate-600 marker:text-slate-300">
                {NOT_COVERED.map((n) => (
                  <li key={n.what}>
                    {n.what}
                    {n.codes && <span className="whitespace-nowrap font-mono text-[11px] text-slate-500"> ({n.codes})</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ---- 2. Teachers ---------------------------------------------- */}
        <Section
          id="teachers"
          n={2}
          title="What teachers get"
          intro="A teacher dashboard for running AlgeBridge with real classes. Teacher accounts need an access code from AlgeBridge. It is one code shared by all teachers, so anyone who has it can make a teacher account."
        >
          <ItemGrid items={TEACHER_ITEMS} />
          <p className="schools-fineprint mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Not built yet:</span> a skill-by-skill grid for each
            student, CSV export, co-teachers, and rostering or sign-in through Clever, ClassLink or Google Classroom.
            Students create their own accounts. <span className="font-semibold text-slate-800">For IT:</span> Google
            sign-in is a third-party app to Google Workspace, so a district that limits those apps for students under
            18 needs to allow it first.
          </p>
        </Section>

        {/* ---- 3. Standards --------------------------------------------- */}
        <Section
          id="standards"
          n={3}
          title="Standards alignment"
          intro={
            <>
              Delaware adopted the Common Core State Standards for Mathematics (CCSS-M) in 2010. We matched each of
              the {TOTAL_SKILLS} skills to the standards it teaches and checked every code against the official text.
              A code means the skill teaches all or part of that standard. Where a skill reviews middle school
              content, we list the grade 6 to 8 standard rather than stretch a high school one. No practice item draws
              or reads a graph yet, so no graphing standard is claimed, and {UNMAPPED} graphing skills cite none.
            </>
          }
        >
          <div className="schools-legend flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <StandardsChip codes={["HSA-REI.B.3"]} label={false} />
              High school standard ({HS_COUNT})
            </span>
            <span className="flex items-center gap-2">
              <StandardsChip codes={["8.EE.A.1"]} label={false} />
              Grade 6 to 8 standard the course reviews ({MS_COUNT})
            </span>
            <span className="print:hidden">Select a code to read the official standard.</span>
            <span className="hidden print:inline">
              Official text: thecorestandards.org/Math. A plain summary of each code is at learn.algebridge.org/schools.
            </span>
          </div>

          <div className="schools-units mt-4 gap-3 lg:columns-2">
            {units.map((unit) => (
              // Folds to the unit's name on a phone; open everywhere else and in print.
              <UnitStandards
                key={unit.id}
                number={unit.number}
                title={unit.title}
                skillCount={unit.skills.length}
                className="schools-unit mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel"
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Unit {unit.number}, {unit.title}: skills and the standards each teaches
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Skill</th>
                      <th scope="col">Standards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.skills.map((skill) => (
                      <tr key={skill.id} className="border-t border-slate-100 first:border-t-0">
                        <th scope="row" className="w-[44%] py-2 pl-4 pr-3 text-left align-top font-normal text-slate-700">
                          {skill.title}
                        </th>
                        <td className="py-2 pr-4 align-top">
                          {(SKILL_STANDARDS[skill.id] ?? []).length > 0 ? (
                            <StandardsChip skillId={skill.id} label={false} />
                          ) : (
                            <span className="text-xs italic text-slate-500">None claimed: no graphing yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </UnitStandards>
            ))}
          </div>

          <div className="schools-notclaimed mt-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Left off on purpose</h3>
            <p className="mt-1 text-sm text-slate-600">
              These standards look like a match from a skill&apos;s name, but the skill does not teach them, so we do
              not claim them.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-3">
                <dt className="w-[6.75rem] shrink-0 text-[12px] font-semibold leading-5 text-slate-500">Graphing</dt>
                <dd className="leading-5 text-slate-600">
                  No item draws a graph or asks a student to read one, so these are not claimed:{" "}
                  {GRAPH_LEFT_OFF.map((g, i) => (
                    <span key={g.code}>
                      <span className="font-mono text-[12px] text-slate-700">{g.code}</span> ({g.skills.join(", ")})
                      {i < GRAPH_LEFT_OFF.length - 1 ? "; " : "."}
                    </span>
                  ))}
                </dd>
              </div>
              {OTHER_LEFT_OFF.map((n) => (
                <div key={`${n.skillId}-${n.code}`} className="flex gap-3">
                  <dt className="w-[6.75rem] shrink-0 font-mono text-[12px] font-medium leading-5 text-slate-500">{n.code}</dt>
                  <dd className="leading-5 text-slate-600">
                    <span className="font-medium text-slate-800">{SKILL_TITLES[n.skillId]}.</span> {n.reason}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="schools-key mt-6">
            <h3 className="text-sm font-semibold text-slate-900">What each standard asks</h3>
            <p className="mt-1 text-sm text-slate-600">
              Our short paraphrase of each code above. The official wording is at{" "}
              <a
                href="https://www.thecorestandards.org/Math/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500"
              >
                thecorestandards.org/Math
              </a>
              .
            </p>
            <PhoneFold summary="Show what each code asks">
            <div className="schools-key-groups mt-4 gap-6 md:columns-2">
              {keyGroups().map((g) => (
                <div key={g.title} className="schools-key-group mb-5 break-inside-avoid">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{g.title}</h4>
                  <dl className="mt-2 space-y-2">
                    {g.items.map((s) => (
                      <div key={s.code} className="flex gap-3 text-sm">
                        <dt className="w-[6.75rem] shrink-0 font-mono text-[12px] font-medium leading-5 text-slate-800">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-bridge-700 hover:underline"
                          >
                            {s.code}
                          </a>
                        </dt>
                        <dd className="leading-5 text-slate-600">{s.summary}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            </PhoneFold>
          </div>
        </Section>

        {/* ---- 4. Privacy and safety ------------------------------------ */}
        <Section
          id="privacy"
          n={4}
          title="Student privacy and safety"
          intro="Students sign in with a free account so their work is saved and their teacher can see it. Here is what that account holds, who can reach a student, and where text goes."
        >
          <ItemGrid items={PRIVACY_ITEMS} />

          <div id="school-mode" className="schools-card mt-4 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel sm:p-5">
            <div className="flex items-center gap-3">
              <Mark mark={{ icon: "school" }} />
              <h3 className="text-[15px] font-semibold text-slate-900">What a district can turn off</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              School mode is one switch for a whole AlgeBridge deployment (the build setting{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px] text-slate-800">NEXT_PUBLIC_SCHOOL_MODE=1</code>), not a
              setting a student can change. When it is on, these leave the side menu and the phone menu, and their
              pages say &quot;Turned off for school accounts&quot; instead. A few links to them still appear (a
              lesson&apos;s &quot;Find a tutor&quot; card, the account menu, and the profile, sign-in and Bridgey House
              pages); they lead to that notice. Turned off:
            </p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm leading-relaxed text-slate-700 sm:grid-cols-2">
              {SCHOOL_MODE_OFF.map((f) => (
                <li key={f.feature} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-slate-900">{f.name}.</span> {f.detail}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-900">Still on:</span> {SCHOOL_MODE_STAYS} It is off unless a
              deployment turns it on, and learn.algebridge.org runs with it off.
            </p>
          </div>

          <div className="schools-card mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold text-slate-900">Waiting on a database update</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              Written and tested, and in effect only once AlgeBridge&apos;s October 2026 database update is applied:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              {PENDING_SAFETY_UPDATE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="schools-ai mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <Mark mark={{ icon: "helper" }} />
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Where AI is used, and what it sees</h3>
                <p className="text-xs text-slate-500 print:hidden">Each AI feature sends only what it needs, to the services named here.</p>
              </div>
            </div>
            {/* Focusable, so a keyboard can scroll the table sideways on a phone. */}
            <div tabIndex={0} role="region" aria-label="Where AI is used" className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bridge-500">
              <table className="schools-ai-table w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    <th scope="col" className="w-[22%] px-4 py-2.5 font-semibold">Feature</th>
                    <th scope="col" className="w-[42%] px-4 py-2.5 font-semibold">What is sent</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Processed by</th>
                  </tr>
                </thead>
                <tbody>
                  {AI_ROWS.map((r) => (
                    <tr key={r.what} className="border-t border-slate-100 align-top">
                      <th scope="row" className="px-4 py-3 font-medium text-slate-900">{r.what}</th>
                      <td className="px-4 py-3 leading-relaxed text-slate-600">{r.sends}</td>
                      <td className="px-4 py-3 leading-relaxed text-slate-600">{r.who}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="schools-crisis border-t border-slate-200 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">A student in danger.</span> Before anything else, Archie
              and the Hints extension check each message against a list of phrases that suggest self-harm, abuse or
              danger: English, the common ways to say it in Spanish, Haitian Creole and Portuguese, the commonest
              phrasings in French, German, Italian, Polish and Vietnamese, and a few phrases in Chinese, Arabic,
              Russian, Ukrainian, Korean and Hindi. Archie also reads a student&apos;s last two
              messages together. A match goes to no AI service and gets fixed words: talk to a trusted adult or the
              school counselor now, call or text 988 or text HOME to 741741 from any phone, chat with 988 online from a
              computer, 988&apos;s Spanish line, or call 911. On the site Archie shows them as a calm card, and nothing
              playful under it. Archie&apos;s check runs in the student&apos;s browser, so a match is not sent to
              AlgeBridge, not saved into a tutor booking and not sent to a tutor; the extension&apos;s check runs on
              AlgeBridge&apos;s server, where its words stop. A message the list misses goes to the AI like any other,
              and the AI is told to send the student to a trusted adult (the extension&apos;s AI is also told to answer
              with a signal that shows the same card). Nobody is alerted, not a teacher or a counselor, and the message
              is not stored. Alerting a school is not built yet; if your district wants it, tell us.
            </div>
          </div>

          <p className="schools-fineprint mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            AlgeBridge does not ask for a birth date or record parental or school consent. The privacy policy asks
            students under 13 to use it with a parent, guardian or teacher, and to make an account only with their
            permission. Details:{" "}
            <Link href="/privacy" className="font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500">
              Privacy Policy
            </Link>
            ,{" "}
            <Link href="/safety" className="font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500">
              Safety and Trust
            </Link>
            ,{" "}
            <Link href="/guidelines" className="font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500">
              Community Guidelines
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-medium text-bridge-700 underline decoration-bridge-200 underline-offset-2 hover:decoration-bridge-500">
              Terms of Service
            </Link>
            .
          </p>
        </Section>

        {/* ---- 5. Accessibility ----------------------------------------- */}
        <Section
          id="accessibility"
          n={5}
          title="Accessibility"
          intro="What is built in today. AlgeBridge has not had a formal accessibility audit and does not claim WCAG conformance. Tell us if something gets in a student's way."
        >
          <ItemGrid items={ACCESS_ITEMS} />
        </Section>

        {/* ---- 6. Cost and contact -------------------------------------- */}
        <Section id="contact" n={6} title="Cost and contact">
          <div className="schools-contact grid gap-3 md:grid-cols-[1fr_1.3fr]">
            <div className="schools-card rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Cost</p>
              <p className="mt-1 font-display text-3xl font-normal leading-none text-slate-900">Free</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                For students, teachers and schools. There is no paid version, no per-student fee and no advertising.
              </p>
            </div>
            <div className="schools-card schools-contact-card rounded-2xl border border-bridge-200 bg-bridge-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bridge-700">Contact</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">Questions, or ready to try it with a class?</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                Email or call us about teacher accounts, data and privacy questions, or anything on this page.
              </p>
              <div className="mt-3 flex flex-col items-start gap-2">
                <a
                  href={`mailto:${CONTACT}`}
                  className="inline-flex items-center gap-2 text-base font-semibold text-bridge-700 underline decoration-bridge-300 underline-offset-4 hover:decoration-bridge-600"
                >
                  <SchoolIcon name="mail" size={18} />
                  {CONTACT}
                </a>
                <a
                  href={PHONE_HREF}
                  className="inline-flex items-center gap-2 text-base font-semibold text-bridge-700 underline decoration-bridge-300 underline-offset-4 hover:decoration-bridge-600"
                >
                  <Icon name="phone" size={18} />
                  {PHONE}
                </a>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Printed at the foot of the handout too: which version this is, and who to write to. */}
      <p className="schools-stamp mt-6 text-xs text-slate-500">
        Version: {VERSION}. Checked against the code as it runs today. Contact: {CONTACT}, {PHONE}. learn.algebridge.org/schools
      </p>
    </article>
  );
}
