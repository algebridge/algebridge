/**
 * Line icons the For schools page needs that the shared set does not have.
 * Same grid, stroke and caps as src/components/Icon.tsx so they sit together.
 */

export type SchoolIconName = "calculator" | "keyboard" | "video" | "motion" | "mail" | "no-ads" | "id-card" | "shield" | "screen-reader";

const PATHS: Record<SchoolIconName, React.ReactNode> = {
  calculator: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M8.5 6.5h7v3h-7z" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
      <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
    </>
  ),
  motion: (
    <>
      <circle cx="15" cy="12" r="5.5" />
      <path d="M3 9h5M2 12h4.5M3 15h5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </>
  ),
  "no-ads": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
      <path d="M9 14.5 10.8 9h.4l1.8 5.5M9.6 12.8h3" />
    </>
  ),
  "id-card": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14.5 10h4M14.5 13.5h3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  "screen-reader": (
    <>
      <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
      <path d="M6 18h6M9 14v4" />
      <path d="M18.5 8.5a4 4 0 0 1 0 5M20.8 6.5a7 7 0 0 1 0 9" />
    </>
  ),
};

export function SchoolIcon({ name, size = 18, className = "" }: { name: SchoolIconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
