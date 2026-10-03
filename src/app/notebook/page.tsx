"use client";

import { Notebook } from "@/components/Notebook";

export default function NotebookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* No Back button: the sidebar, and the menu on a phone, lead back to the course. */}
      <header>
        <p className="eyebrow">Learn</p>
        <h1 className="page-title">My notebook</h1>
        <p className="page-subtitle">
          Your private space for notes, worked-out steps, and questions for your tutor.
        </p>
      </header>
      <div className="card">
        <Notebook hideTitle />
      </div>
    </div>
  );
}
