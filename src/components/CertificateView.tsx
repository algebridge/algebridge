"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { units } from "@/data/curriculum";
import { CourseCertificate, CERTIFICATE_SIZE, UnitCertificate } from "@/components/Certificate";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/lib/auth";
import { formatName, isRealName } from "@/lib/name";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import {
  certificateDateText,
  COURSE_ID,
  courseCertificateDate,
  skillIsFinished,
  unitCertificateDate,
  unitIsFinished,
} from "@/lib/certificates";
import type { UserProgress } from "@/types";

/** This device remembers the name typed for printing, so the next certificate has it already. */
/**
 * The name typed for printing, kept per account: one key for the whole
 * device showed the last student's full name on the next student's
 * certificate on a shared Chromebook. Sign-out clears every one of them
 * (CERTIFICATE_NAME_PREFIX in lib/auth).
 */
const NAME_KEY = "ab-certificate-name";

async function asDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves the certificate as a PNG at twice the page's drawing size. The SVG is
 * drawn onto a canvas as a picture, which loads nothing from outside itself,
 * so the logo goes in as data first.
 */
async function savePicture(svg: SVGSVGElement, filename: string): Promise<void> {
  const scale = 2;
  const width = CERTIFICATE_SIZE.width * scale;
  const height = CERTIFICATE_SIZE.height * scale;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const logo = await asDataUrl("/brand/logo-icon.png");
  clone.querySelectorAll("image").forEach((img) => img.setAttribute("href", logo));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The certificate could not be drawn."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas here.");
    ctx.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("The picture could not be made.");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The name a certificate carries: the account's own, unless this device was
 * given another one for printing (a student signed out, or a nickname on
 * the account).
 */
export function useCertificateName(): [string, (next: string) => void] {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const key = `${NAME_KEY}:${user?.id ?? "guest"}`;

  useEffect(() => {
    let typed: string | null = null;
    try {
      // The old key was one for the whole device, so whose name it held is unknown.
      localStorage.removeItem(NAME_KEY);
      typed = localStorage.getItem(key);
    } catch {
      /* storage blocked: the account's name it is */
    }
    if (typed !== null) setName(typed);
    else if (profile?.displayName && isRealName(profile.displayName)) setName(formatName(profile.displayName));
    else setName("");
  }, [profile, key]);

  function changeName(next: string) {
    setName(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* kept for this visit */
    }
  }

  return [name, changeName];
}

export function CertificateView({ id }: { id: string }) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [name, changeName] = useCertificateName();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setProgress(getProgress());
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  const course = id === COURSE_ID;
  const unit = course ? null : units.find((u) => u.id === id) ?? null;
  if (!course && !unit) return null;

  if (!progress) {
    return <div className="aspect-[11/8.5] w-full animate-pulse rounded-2xl bg-slate-200/60" aria-busy="true" />;
  }

  const earnedAt = course ? courseCertificateDate(progress) : unitCertificateDate(progress, unit!);
  const title = course ? "Algebra 1" : `Unit ${unit!.number}: ${unit!.title}`;

  if (!earnedAt) {
    const doneUnits = units.filter((u) => unitIsFinished(progress, u)).length;
    const doneSkills = unit ? unit.skills.filter((s) => skillIsFinished(progress, s.id)).length : 0;
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <header>
          <p className="eyebrow">Certificate</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {course
              ? `Finish all ${units.length} units and this certificate is yours, with the date you finished.`
              : `Finish all ${unit!.skills.length} skills in this unit and this certificate is yours, with the date you finished.`}
          </p>
        </header>
        <div className="card space-y-4">
          <ProgressBar
            label={course ? "Units finished" : "Skills finished"}
            value={course ? doneUnits : doneSkills}
            max={course ? units.length : unit!.skills.length}
            unit="finished"
          />
          {unit && (
            <ul className="space-y-1.5 text-sm">
              {unit.skills.map((s) => {
                const done = skillIsFinished(progress, s.id);
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "border border-slate-300 text-slate-300"}`}
                    >
                      {done && <Icon name="check" size={12} />}
                    </span>
                    <Link href={`/learn/${unit.id}/${s.id}`} className={done ? "text-slate-500" : "font-medium text-slate-900 hover:underline"}>
                      {s.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href={course ? "/" : `/unit/${unit!.id}`} className="btn-primary inline-flex">
            {course ? "Back to the course" : `Go to Unit ${unit!.number}`}
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const date = certificateDateText(earnedAt);
  const filename = course ? "AlgeBridge Algebra 1 certificate.png" : `AlgeBridge Unit ${unit!.number} certificate.png`;

  async function save() {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(true);
    setError(null);
    try {
      await savePicture(svg, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The picture could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Printing shows the certificate alone, edge to edge on a sideways page. */}
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0; }
          html, body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          .certificate-print, .certificate-print * { visibility: visible !important; }
          .certificate-print { position: fixed !important; inset: 0 !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .certificate-print svg { width: 100vw !important; height: 100vh !important; }
        }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Certificate</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">Earned {date}.</p>
        </div>
        <Link href="/achievements#certificates" className="btn-ghost btn-sm">
          All certificates
        </Link>
      </header>

      <div className="card flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className="text-sm font-semibold text-slate-900">Name on the certificate</span>
          <input
            value={name}
            onChange={(e) => changeName(e.target.value)}
            maxLength={40}
            placeholder="Your first and last name"
            autoComplete="name"
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="btn-primary">
            <Icon name="printer" size={17} />
            Print
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-secondary">
            <Icon name="download" size={17} />
            {saving ? "Saving..." : "Save as a picture"}
          </button>
        </div>
        {error && (
          <p role="alert" className="w-full text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>

      <div ref={holder} className="certificate-print overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
        {course ? (
          <CourseCertificate name={name.trim()} date={date} className="block h-auto w-full" />
        ) : (
          <UnitCertificate unit={unit!} name={name.trim()} date={date} className="block h-auto w-full" />
        )}
      </div>
    </div>
  );
}
