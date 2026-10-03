/**
 * Routes that render without the app shell: no menu, header, banner, footer
 * or floating buttons. /try is embedded by algebridge.org in an iframe and
 * must be the card alone. The attribute goes on <html> before first paint
 * (bareRouteBootScript, in the layout's head), and globals.css hides the
 * shell's parts under it; the shell itself still mounts, since the layout is
 * shared by every page.
 */
export const BARE_ROUTES = ["/try"];

export function isBareRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function bareRouteBootScript(): string {
  return `(function(){try{var p=location.pathname;if(${JSON.stringify(BARE_ROUTES)}.some(function(r){return p===r||p.indexOf(r+"/")===0}))document.documentElement.setAttribute("data-bare","")}catch(e){}})();`;
}
