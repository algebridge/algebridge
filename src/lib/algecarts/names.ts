/**
 * The name a racer wears on the track: "First L." from the account's real
 * name, the way the bots are named. Students never type one, so a public
 * lobby never carries a name somebody made up.
 */
export function racerNameOf(displayName: string | null | undefined): string {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0].slice(0, 12);
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return last ? `${first} ${last.toUpperCase()}.` : first;
}
