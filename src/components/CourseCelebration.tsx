"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { units } from "@/data/curriculum";
import { CourseCertificate } from "@/components/Certificate";
import { Icon } from "@/components/Icon";
import { UnitMark } from "@/components/UnitMark";
import { unitHue } from "@/lib/hues";
import { certificateDateText, courseFacts } from "@/lib/certificates";
import type { UserProgress } from "@/types";

/** How long new fireworks go up. The last ones fade out after it, and the loop stops. */
const SHOW_MS = 9000;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/**
 * Fireworks over the page: bursts in the units' colors, for a fixed show.
 * The animation loop ends when the last spark fades, so nothing keeps
 * running after the moment is over.
 */
function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const colors = units.map((u) => unitHue(u.id).bar);
    const sparks: Spark[] = [];
    const start = performance.now();
    let nextBurst = start;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const burst = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.12 + Math.random() * 0.38);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const count = 46 + Math.floor(Math.random() * 24);
      const speed = 2.4 + Math.random() * 2;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const v = speed * (0.55 + Math.random() * 0.45);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };

    const tick = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (now - start < SHOW_MS && now >= nextBurst) {
        burst();
        if (Math.random() < 0.35) burst();
        nextBurst = now + 380 + Math.random() * 520;
      }
      ctx.clearRect(0, 0, w, h);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.045;
        s.life -= 0.0125;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, s.life * 1.4);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.2 + s.life * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (now - start < SHOW_MS || sparks.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}

/**
 * The end of the course: the whole screen, fireworks, every unit's mark in a
 * row, the student's own numbers, and the course certificate to print.
 */
export function CourseCelebration({ progress, name, onClose }: { progress: UserProgress; name: string; onClose: () => void }) {
  const facts = courseFacts(progress);
  const date = certificateDateText(progress.courseCompletedAt ?? new Date().toISOString());
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Focus without scrolling to the button: the headline is what shows first.
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The page under it holds still while it is up.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const stats = [
    { value: facts.units, label: facts.units === 1 ? "unit" : "units" },
    { value: facts.skills, label: facts.skills === 1 ? "skill" : "skills" },
    { value: facts.problemsSolved, label: facts.problemsSolved === 1 ? "problem solved" : "problems solved" },
    { value: facts.flawless, label: facts.flawless === 1 ? "skill with no misses" : "skills with no misses" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-done-title"
      className="fixed inset-0 z-[90] overflow-y-auto bg-[radial-gradient(ellipse_at_top,#1e3a8a_0%,#0b1533_60%,#070d22_100%)] text-white"
    >
      <Fireworks />
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
        <p className="animate-pop-in text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Course complete</p>
        <h2 id="course-done-title" className="animate-pop-in mt-3 font-display text-5xl leading-none tracking-wide sm:text-7xl">
          You finished Algebra&nbsp;1
        </h2>
        <p className="mt-4 max-w-xl text-base text-blue-100 sm:text-lg">
          Every unit. Every skill. Each one finished with five right on the first try.
        </p>

        <ul className="mt-7 flex max-w-xl flex-wrap justify-center gap-2" aria-label="The units you finished">
          {units.map((u, i) => {
            const hue = unitHue(u.id);
            return (
              <li
                key={u.id}
                title={`Unit ${u.number}: ${u.title}`}
                className="animate-pop-in flex h-10 w-10 items-center justify-center rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                style={{ background: hue.solid, color: hue.onSolid, animationDelay: `${300 + i * 90}ms`, animationFillMode: "both" }}
              >
                <UnitMark unitId={u.id} size={20} />
                <span className="sr-only">
                  Unit {u.number}: {u.title}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-3xl tabular-nums tracking-wide">{s.value.toLocaleString("en-US")}</dd>
              <dd className="mt-0.5 text-xs text-blue-200">{s.label}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 w-full max-w-md overflow-hidden rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/20">
          <CourseCertificate name={name} date={date} className="block h-auto w-full" />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            ref={primary}
            href="/certificate/course"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-6 py-3 text-base font-bold text-slate-900 shadow-lg transition hover:-translate-y-px hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/60"
          >
            <Icon name="printer" size={18} />
            Get your certificate
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-6 py-3 text-base font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          >
            Back to practice
          </button>
        </div>
      </div>
    </div>
  );
}
