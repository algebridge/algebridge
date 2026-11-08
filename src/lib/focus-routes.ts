/**
 * Pages where nothing pops up over the student's work: no first-visit
 * intro, no interests picker, no tour, no mood survey. Test review is one: a
 * student arrives with a graded test in hand and a photo to take, and a modal
 * about skill videos or favourite sports in the way of the camera is noise.
 * The popups wait for the next ordinary page. The shell (menu, header) stays.
 */
export const FOCUS_ROUTES = ["/test-review"];

export function isFocusRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.split(/[?#]/)[0];
  return FOCUS_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));
}
