/**
 * Who can open the arcade while it is being tested. Matched on the account's
 * real name, the way the Alge Carts demo was. Everyone else keeps the games
 * page they had. Empty the gate (return true) to open the arcade to everyone.
 */
const TESTERS = ["ivan dubovyi", "zach balan", "zack balan", "zachary balan", "shaurya sethi", "vivaan babbar", "kevin frijo", "sampreeth male"];
function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isArcadeTester(displayName: string | null | undefined): boolean {
  return TESTERS.includes(normalizeName(displayName));
}
