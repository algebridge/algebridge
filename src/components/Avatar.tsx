"use client";

interface AvatarProps {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: number;
  className?: string;
}

function initials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic soft color from the name so avatars are visually distinct.
function colorFor(name: string | null | undefined): string {
  const colors = [
    "#2563eb", "#7c3aed", "#db2777", "#ea580c",
    "#16a34a", "#0891b2", "#ca8a04", "#dc2626",
  ];
  const s = name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return colors[h % colors.length];
}

export function Avatar({ name, url, size = 48, className = "" }: AvatarProps) {
  const dim = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? "Avatar"}
        style={dim}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...dim, backgroundColor: colorFor(name), fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
