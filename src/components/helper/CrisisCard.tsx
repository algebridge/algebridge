"use client";

import { Archie } from "@/components/archie/Archie";
import { Icon } from "@/components/Icon";
import { CRISIS_CHAT, CRISIS_CONTACTS, CRISIS_EMERGENCY, CRISIS_SPANISH } from "@/lib/helper";

/**
 * What Archie shows when a student's message sounds like they are in danger
 * (detectCrisis in lib/helper.ts). Not a chat bubble: a calm card across the
 * conversation, with the people to reach as buttons a phone can act on.
 * Fixed words, the same as CRISIS_REPLY, which screen readers get whole.
 * Nothing hangs off it: no reactions, no jokes, no follow-up chips.
 *
 * The call and text buttons open a phone's dialer; on a school Chromebook
 * they do nothing, so the card says "from any phone" and adds the 988
 * Lifeline's web chat, plus 988's own Spanish line.
 *
 * The student's words stay on this device. The panel shows this card before
 * anything is sent, and the server answers the same way if a message gets
 * that far.
 *
 * voice "plain" is the same card outside Archie (the report dialog): no
 * Archie, and no "I'm an AI math helper", since he is not the one speaking.
 * Screen readers then read the card's own words instead of CRISIS_REPLY.
 */
export function CrisisCard({ reply, voice = "archie" }: { reply: string; voice?: "archie" | "plain" }) {
  const archie = voice === "archie";
  return (
    <section
      aria-label="Help from a real person"
      className="crisis-card helper-in rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5"
    >
      {archie && <p className="sr-only">{reply}</p>}
      <div aria-hidden={archie ? "true" : undefined}>
        {archie ? (
          <div className="flex items-start gap-3">
            <div className="-ml-1 -mt-1 shrink-0">
              <Archie pose="idle" size={52} blink bob={false} look={{ x: 0, y: 0.35 }} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[15px] font-semibold leading-snug text-slate-900">I&apos;m really glad you told me.</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">
                I&apos;m an AI math helper, and this needs a real person who can help you.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[15px] font-semibold leading-snug text-slate-900">What you wrote sounds serious.</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">
              A report is not read right away, so please reach a real person who can help you now.
            </p>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-teal-100">
          <p className="text-[14px] font-semibold text-slate-900">Talk to a trusted adult now</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
            Like a parent, a teacher, or your school counselor.
          </p>
        </div>

        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">In the US, any time, from any phone</p>
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {CRISIS_CONTACTS.map((c) => (
          <li key={c.id}>
            <a
              href={c.href}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 transition hover:ring-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800" aria-hidden="true">
                <Icon name={c.id === "call-988" ? "phone" : "messages"} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-slate-900">{c.action}</span>
                <span className="block text-[12.5px] text-slate-600">{c.detail}</span>
              </span>
            </a>
          </li>
        ))}
        <li>
          <a
            href={CRISIS_CHAT.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 transition hover:ring-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800" aria-hidden="true">
              <Icon name="external" size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-slate-900">{CRISIS_CHAT.action}</span>
              <span className="block text-[12.5px] text-slate-600">{CRISIS_CHAT.detail}</span>
            </span>
          </a>
        </li>
      </ul>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-700">
        <span aria-hidden="true">Both are free, confidential, and open 24/7. If you are in danger right now, </span>
        <a href={CRISIS_EMERGENCY.href} className="font-semibold text-teal-900 underline decoration-teal-300 underline-offset-2">
          call 911
        </a>
        .
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700" lang="es">
        {CRISIS_SPANISH.text}{" "}
        <a
          href={CRISIS_SPANISH.chatHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-900 underline decoration-teal-300 underline-offset-2"
        >
          Chat en español
        </a>
      </p>
    </section>
  );
}
