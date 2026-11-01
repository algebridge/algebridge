/**
 * Who can open the Alge Carts demo while it is a demo. Matched on the
 * account's real name, the way the unlimited-Bridgeys seed matches Ivan.
 */
const TESTERS = ["ivan dubovyi", "zach balan", "zack balan", "shaurya sethi"];

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isCartsTester(displayName: string | null | undefined): boolean {
  return TESTERS.includes(normalizeName(displayName));
}

/** The first word of a real name, for the kart's name tag. */
export function firstNameOf(displayName: string | null | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0] ?? "";
}

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
