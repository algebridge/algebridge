/**
 * Where a sign-in may send the student afterwards: a path on this site and
 * nothing else. ?next= (and the destination held across a Google sign-in)
 * comes from the address bar, so an absolute link, a protocol-relative one
 * ("//host"), a backslash (browsers read "\" as "/") or a control character
 * (browsers drop tabs and newlines inside a URL) could send the student to
 * another site straight after they typed their password.
 *
 * Returns the path (with its query and hash) or null.
 */
const SAME_SITE = "https://same-site.invalid";
const MAX_LENGTH = 500;

export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (raw[0] !== "/" || raw[1] === "/") return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, SAME_SITE);
    if (url.origin !== SAME_SITE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
