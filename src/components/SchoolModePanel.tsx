"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import {
  SCHOOL_FEATURE_NAMES,
  SCHOOL_MODE,
  SCHOOL_MODE_EVENT,
  SCHOOL_MODE_PREVIEW_KEY,
  schoolModeNow,
  type SchoolFeature,
} from "@/lib/school-mode";

function subscribe(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SCHOOL_MODE_PREVIEW_KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SCHOOL_MODE_EVENT, fn);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SCHOOL_MODE_EVENT, fn);
  };
}
const getServer = () => SCHOOL_MODE;

/**
 * Is school mode on? The build's switch (NEXT_PUBLIC_SCHOOL_MODE), or in
 * development a preview a developer turned on in this browser. The server
 * render uses the build's switch alone, so a production page never flickers.
 */
export function useSchoolMode(): boolean {
  return useSyncExternalStore(subscribe, schoolModeNow, getServer);
}

/** The panel a turned-off page shows instead of itself. */
export function SchoolModePanel({ feature }: { feature: SchoolFeature }) {
  const name = SCHOOL_FEATURE_NAMES[feature];
  return (
    <section
      aria-labelledby="school-off-title"
      className="mx-auto mt-6 max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-panel"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bridge-50 text-bridge-600 ring-1 ring-inset ring-bridge-100" aria-hidden>
        <Icon name="school" size={24} />
      </span>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{name}</p>
      <h1 id="school-off-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        Turned off for school accounts
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
        This version of AlgeBridge is set up for a school, so this part is switched off. Lessons, practice and Archie
        work as usual. For help from a person, ask your teacher.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          Back to the course
        </Link>
        <Link href="/schools#school-mode" className="btn-secondary">
          What is turned off
        </Link>
      </div>
    </section>
  );
}

/** A page, or the panel in its place when school mode is on. */
export function SchoolGate({ feature, children }: { feature: SchoolFeature; children: ReactNode }) {
  const on = useSchoolMode();
  return on ? <SchoolModePanel feature={feature} /> : <>{children}</>;
}

/** Something shown only when school mode is off, like the games banner on the course page. */
export function HideInSchoolMode({ children }: { children: ReactNode }) {
  const on = useSchoolMode();
  return on ? null : <>{children}</>;
}
