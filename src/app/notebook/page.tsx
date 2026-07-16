"use client";

import Link from "next/link";
import { Notebook } from "@/components/Notebook";

export default function NotebookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-slate-900">My Notebook</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your private space for notes, worked-out steps, and questions for your tutor.
          </p>
        </div>
        <Link href="/" className="btn-secondary text-sm">Back to Course</Link>
      </div>
      <div className="card">
        <Notebook />
      </div>
    </div>
  );
}
