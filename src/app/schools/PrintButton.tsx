"use client";

/** Opens the browser's print dialog; the page's print stylesheet does the rest. */
export function PrintButton({ className = "btn-primary" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 9V3.5h10V9" />
        <rect x="3.5" y="9" width="17" height="8" rx="2" />
        <path d="M7 14h10v6.5H7z" />
        <path d="M17.5 12h.01" />
      </svg>
      Print this page
    </button>
  );
}
