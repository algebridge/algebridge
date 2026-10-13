/**
 * Algebra 2 is open to a few people for now: Ivan Dubovyi and Zach Balan, on
 * any of their accounts, and William Connor. Everyone else who finds /algebra-2 (or one of its
 * unit or lesson pages) gets "page not found".
 *
 * The allowed emails are kept as salted SHA-256 fingerprints, so the
 * addresses themselves are not readable in the site's JavaScript. Google
 * sign-in uses the same address, so it is covered too.
 *
 * To let in another account:
 *   printf '%s' "algebridge-a2:someone@example.com" | shasum -a 256
 * and add the hash below (email in lower case, no spaces).
 *
 * The seven today are Ivan's algebridge.org, personal and school accounts, his
 * Claude account email, Zach's algebridge.org and personal accounts, and
 * William Connor's school account.
 *
 * This is a gate in the app, not a vault: the lessons' code ships to every
 * browser like the rest of the site. It keeps the section out of sight.
 */
export const ALGEBRA2_ACCESS: readonly string[] = [
  "b045889ccfc7cd263df45cf2eef720ddab3b8883b8450e12f3e98feb3576b40c",
  "1613d3f69b99f668c55ba9588f67e7a2052b34ee53e30cdfa547a3ff649529fb",
  "8dc5bd9b7dadacb8900b5a6951bb20d3b20c5052542efc24fe6aa499dd579d70",
  "d9f0a586a62f3b37e9f6d2fa8d71939403c683e5c235fb18a06cf62d94d87678",
  "fa6bc15ef24510006dd3fe386bc881e1a2049f63651ddaa5bc87e3ce5d2539c2",
  "258e4a66ad677c5509450920129d75780af16fd8fc3ae56d18eb30391f19cd21",
  "048206bf6d0b3004fcae6cd933b54b767dd52109d939210a0a528462729c529a",
];

export async function fingerprint(email: string): Promise<string> {
  const data = new TextEncoder().encode(`algebridge-a2:${email.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasAlgebra2Access(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return ALGEBRA2_ACCESS.includes(await fingerprint(email));
}
