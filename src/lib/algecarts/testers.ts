/**
 * Who can open the Alge Carts demo while it is a demo. Matched on the
 * account's real name, the way the unlimited-Bridgeys seed matches Ivan.
 */
const TESTERS = ["ivan dubovyi", "zach balan", "shaurya sethi"];

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
