/**
 * Small stroke-icon set for navigation and page headers.
 * Line icons (rather than emoji) are what make the app read as a platform
 * instead of a toy. The whole app uses them, rewards and the house included:
 * emoji draw differently on every device.
 */

export type IconName =
  | "course"
  | "review"
  | "turn"
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
  | "eye-off"
  | "close"
  | "grip"
  | "helper"
  | "flame"
  | "coin"
  | "play"
  | "speaker"
  | "speaker-off"
  | "music"
  | "hint"
  | "external"
  | "spark"
  | "x-circle"
  | "pen"
  | "eraser"
  | "arrow-right"
  | "arrow-left"
  | "school"
  | "star"
  | "mic"
  | "mic-off"
  | "video"
  | "video-off"
  | "phone"
  | "flag"
  | "shield"
  | "search"
  | "keyboard"
  | "backspace"
  | "enter"
  | "printer"
  | "download"
  | "versus";

const PATHS: Record<IconName, React.ReactNode> = {
  course: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 5.5v11a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5Z" />
      <path d="M12 6v14" />
    </>
  ),
  turn: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v4.5h-4.5" />
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
  close: <path d="M6 6l12 12M18 6 6 18" />,
  flame: <path d="M12 3c.4 2.9 3.6 4.6 3.6 8.3a3.6 3.6 0 0 1-7.2 0c0-1.3.5-2.2 1.1-3C7.6 9.7 6 11.8 6 14.6A6 6 0 0 0 12 21a6 6 0 0 0 6-6.3C18 9.2 13.4 7 12 3Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  play: <path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7Z" />,
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
    </>
  ),
  "speaker-off": (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V6l10-2v11.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </>
  ),
  hint: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </>
  ),
  spark: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z" />,
  pen: (
    <>
      <path d="M4 20l4.5-1.2L19 8.3a2 2 0 0 0 0-2.8l-.5-.5a2 2 0 0 0-2.8 0L5.2 15.5Z" />
      <path d="M13.5 7.3l3.2 3.2" />
    </>
  ),
  eraser: (
    <>
      <path d="M7 20h11" />
      <path d="M5.5 15.5 14 7a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12.5 18.5H9L5.5 15.5Z" />
      <path d="M10 11l5 5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 13.5h.01M11 13.5h.01M14.5 13.5h.01M8 15.5h8" />
    </>
  ),
  backspace: (
    <>
      <path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7Z" />
      <path d="M12 9.5l5 5M17 9.5l-5 5" />
    </>
  ),
  enter: (
    <>
      <path d="M19 5v7a2 2 0 0 1-2 2H6" />
      <path d="M10 10l-4 4 4 4" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v6.5H7Z" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7 10.5l5 5 5-5" />
      <path d="M5 19.5h14" />
    </>
  ),
  versus: (
    <>
      <circle cx="7" cy="7.5" r="2.6" />
      <circle cx="17" cy="7.5" r="2.6" />
      <path d="M2.5 19c.4-3 2.2-5 4.5-5s4.1 2 4.5 5M12.5 19c.4-3 2.2-5 4.5-5s4.1 2 4.5 5" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  school: (
    <>
      <path d="M3.5 20h17" />
      <path d="M5.5 20v-8.5L12 7l6.5 4.5V20" />
      <path d="M12 7V3h4.5l-1.2 1.5L16.5 6H12" />
      <path d="M10 20v-4.5h4V20" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.6l-5 2.7.9-5.6-4-4 5.6-.8Z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  "mic-off": (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      <path d="m4 4 16 16" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </>
  ),
  "video-off": (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
      <path d="m3 3 18 18" />
    </>
  ),
  phone: (
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 5.3 5.3l1.4-2.2L19 14.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  flag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 4.5h11l-2 3.75 2 3.75h-11" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6Z" />
      <path d="m9 12 2.2 2.2 4-4.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  "x-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>
  ),
  helper: (
    <>
      <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.6A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7Z" />
      <path d="M10 10.2a2 2 0 1 1 2.9 1.8c-.6.3-.9.8-.9 1.4" />
      <path d="M12 15.6h.01" />
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
