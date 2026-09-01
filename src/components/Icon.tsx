/**
 * Small stroke-icon set for navigation and page headers.
 * Line icons (rather than emoji) are what make the app read as a platform
 * instead of a toy, emoji stay in the rewards/house features on purpose.
 */

export type IconName =
  | "course"
  | "review"
  | "classes"
  | "teach"
  | "tutors"
  | "students"
  | "messages"
  | "groups"
  | "notebook"
  | "trophy"
  | "leaderboard"
  | "house"
  | "admin"
  | "settings"
  | "plus"
  | "check"
  | "clock"
  | "chevron-up"
  | "chevron-down"
  | "trash"
  | "archive"
  | "copy"
  | "lock"
  | "eye"
  | "eye-off";

const PATHS: Record<IconName, React.ReactNode> = {
  course: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 5.5v11a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5Z" />
      <path d="M12 6v14" />
    </>
  ),
  review: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4.5h4.5" />
    </>
  ),
  classes: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  teach: (
    <>
      <path d="m3 8 9-4 9 4-9 4Z" />
      <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
      <path d="M21 8v5" />
    </>
  ),
  tutors: (
    <>
      <circle cx="11" cy="8" r="3.2" />
      <path d="M4.5 19a6.5 6.5 0 0 1 13 0" />
      <path d="m17.5 6.5 1.6 1.6 3-3" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3 3 0 0 1 0 5.8" />
      <path d="M18 14.2A5.5 5.5 0 0 1 21 19" />
    </>
  ),
  messages: <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.6A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7Z" />,
  groups: (
    <>
      <circle cx="9" cy="9" r="2.6" />
      <circle cx="16.5" cy="10.5" r="2.1" />
      <path d="M3.5 18.5a5.5 5.5 0 0 1 11 0" />
      <path d="M15 15.2a4.6 4.6 0 0 1 5.5 3.3" />
    </>
  ),
  notebook: (
    <>
      <path d="M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6Z" />
      <path d="M6 4v16" />
      <path d="M3.5 8H6M3.5 12H6M3.5 16H6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 5.5H5.5V7a3 3 0 0 0 3 3M16 5.5h2.5V7a3 3 0 0 1-3 3" />
      <path d="M12 13v3M9 20h6l-.6-2.6a1 1 0 0 0-1-.8h-2.8a1 1 0 0 0-1 .8Z" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M4 20V12h4v8M10 20V5h4v15M16 20v-6h4v6" />
      <path d="M3 20h18" />
    </>
  ),
  house: (
    <>
      <path d="m4 10.5 8-6 8 6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  admin: (
    <>
      <path d="m12 3 7 3v5.5c0 4.2-2.9 7.6-7 8.5-4.1-.9-7-4.3-7-8.5V6Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  "chevron-up": <path d="m6 14.5 6-6 6 6" />,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7l.8 11.6a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" />
    </>
  ),
  archive: (
    <>
      <path d="M3.5 6.5h17v3h-17Z" />
      <path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M10 13h4" />
    </>
  ),
  copy: (
    <>
      <path d="M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <path d="M15 6.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1.5" />
    </>
  ),
  lock: (
    <>
      <path d="M6.5 10.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M10.6 6.7A8.6 8.6 0 0 1 12 6.6c6 0 9.5 5.4 9.5 5.4a16.6 16.6 0 0 1-3.4 3.9" />
      <path d="M6.4 8.2A16.4 16.4 0 0 0 2.5 12s3.5 5.4 9.5 5.4a8.7 8.7 0 0 0 3.4-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m4 4 16 16" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
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
