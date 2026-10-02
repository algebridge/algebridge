import type { Metadata } from "next";
import Link from "next/link";
import "./schools.css";
import { units } from "@/data/curriculum";
import { skillOffersCalculator } from "@/data/problem-banks";
import {
  NOT_CLAIMED,
  SKILL_STANDARDS,
  citedStandards,
  levelLabel,
  type Standard,
} from "@/data/standards";
import { StandardsChip } from "@/components/StandardsChip";
import { Icon, type IconName } from "@/components/Icon";
import { PrintButton } from "./PrintButton";
import { SchoolIcon, type SchoolIconName } from "./icons";

/*
 * A page for a school or district audience. Every sentence here was checked
 * against the code (Oct 2026): src/app/teacher, src/lib/teacher.ts,
 * src/lib/assignments.ts, src/lib/path.ts, src/lib/spaced-repetition.ts,
 * src/lib/diagnose.ts, src/app/api/*, src/lib/social.ts, the room page and
 * supabase/schema-2026-09-22.sql. Counts are computed from the data, never
 * typed in. If a feature changes, change this page with it.
 */

export const metadata: Metadata = {
  title: "For schools, AlgeBridge",
  description:
    "AlgeBridge for schools and districts: a free Algebra 1 course for grades 7 to 10, teacher tools, Common Core standards alignment, and how student data is handled.",
};

const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);
const CITED = citedStandards();
const HS_COUNT = CITED.filter((s) => s.level === "HS").length;
const MS_COUNT = CITED.length - HS_COUNT;
const MAPPED = units.flatMap((u) => u.skills).filter((s) => (SKILL_STANDARDS[s.id] ?? []).length > 0).length;
const CALC_SKILLS = units.flatMap((u) => u.skills).filter((s) => skillOffersCalculator(s.id, s.problems)).length;
const SKILL_TITLES: Record<string, string> = Object.fromEntries(units.flatMap((u) => u.skills.map((s) => [s.id, s.title])));

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
    body: "A video lesson from a public YouTube math channel such as Math Antics or Khan Academy, neither of which is affiliated with AlgeBridge.",
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
    mark: { icon: "spark" },
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
    body: "Students join with the class's 6-character code. Or paste a column of school emails from a gradebook; each student needs an AlgeBridge account first.",
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
    mark: { icon: "messages" },
    title: "Students only message staff",
    body: "A student cannot send a direct message to another student. Every direct message has a tutor, teacher or AlgeBridge admin on one end, and the database enforces this, not only the app. Group chats are started by a tutor, who picks the students and is in the group.",
  },
  {
    mark: { glyph: "video" },
    title: "Private calls, not recorded",
    body: "Video calls connect a student with a tutor or teacher, never two students, on a channel only those two can join. Video and audio go straight between the two browsers and are not recorded. Captions are off unless someone turns them on, and then come from the browser's speech recognition (a Google service in Chrome). After a call, a short text recap is sent as a message.",
  },
  {
    mark: { icon: "lock" },
    title: "Who can see what",
    body: "The database uses row-level security. A student reads only their own records. A teacher sees the progress of students on their own class rosters. Tutors, whose accounts need an access code, can see student names and email addresses so they can answer requests for help.",
  },
  {
    mark: { icon: "leaderboard" },
    title: "Leaderboard",
    body: "Shows a first name and last initial with practice totals, only to signed-in users. A student can take themselves off it with one checkbox.",
  },
  {
    mark: { glyph: "no-ads" },
    title: "No ads, nothing sold",
    body: "AlgeBridge shows no ads and does not sell student data. A student can delete their account and all its data from their account page at any time.",
  },
];

const AI_ROWS: { what: string; sends: string; who: string }[] = [
  {
    what: "Archie, the study helper",
    sends: "The problem on screen and what the student types. Not their name or email.",
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
    what: "Call recaps",
    sends: "The call's captions, if they were on, and the student's notes.",
    who: "Anthropic or OpenAI when one is configured; otherwise a template on AlgeBridge's own server.",
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
          A free Algebra 1 course for grades 7 to 10 that runs in a web browser, with nothing to install. Below: what
          students do, what teachers get, how the course lines up with the Common Core standards Delaware uses, and
          how student data is handled. Everything here describes the course as it works today.
        </p>
        <div className="schools-actions mt-5 flex flex-wrap gap-3 print:hidden">
          <PrintButton />
          <a href="mailto:support@algebridge.org" className="btn-secondary">
            <SchoolIcon name="mail" size={16} />
            support@algebridge.org
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
        </Section>

        {/* ---- 2. Teachers ---------------------------------------------- */}
        <Section
          id="teachers"
          n={2}
          title="What teachers get"
          intro="A teacher dashboard for running AlgeBridge with real classes. Teacher accounts need an access code from AlgeBridge, so a student cannot make themselves a teacher."
        >
          <ItemGrid items={TEACHER_ITEMS} />
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
              content, we list the grade 6 to 8 standard rather than stretch a high school one.
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
              <div
                key={unit.id}
                className="schools-unit mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel"
              >
                <h3 className="flex items-baseline gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900">
                  <span className="shrink-0 text-xs font-semibold text-bridge-700">Unit {unit.number}</span>
                  <span>{unit.title}</span>
                </h3>
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
                          <StandardsChip skillId={skill.id} label={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="schools-notclaimed mt-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Left off on purpose</h3>
            <p className="mt-1 text-sm text-slate-600">
              These standards look like a match from a skill&apos;s name, but the skill does not teach them, so we do
              not claim them.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {NOT_CLAIMED.map((n) => (
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

          <div className="schools-ai mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <Mark mark={{ icon: "helper" }} />
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Where AI is used, and what it sees</h3>
                <p className="text-xs text-slate-500">Each AI feature sends only what it needs, to the services named here.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
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
          </div>

          <p className="schools-fineprint mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            AlgeBridge does not ask for a birth date. The privacy policy asks students under 13 to use AlgeBridge with a
            parent, guardian or teacher, and to create an account only with their permission. Full details:{" "}
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
          intro="What is built in today. AlgeBridge has not had a formal accessibility audit and does not claim WCAG conformance. If something gets in a student's way, tell us and we will look at it."
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
                Email us about teacher accounts, data and privacy questions, or anything on this page.
              </p>
              <a
                href="mailto:support@algebridge.org"
                className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-bridge-700 underline decoration-bridge-300 underline-offset-4 hover:decoration-bridge-600"
              >
                <SchoolIcon name="mail" size={18} />
                support@algebridge.org
              </a>
            </div>
          </div>
          <p className="schools-stamp mt-6 text-xs text-slate-400">
            Checked against the course in October 2026. learn.algebridge.org/schools
          </p>
        </Section>
      </div>
    </article>
  );
}
