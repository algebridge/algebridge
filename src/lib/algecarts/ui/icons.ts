import type { WeaponId } from "../engine/types";

const svg = (body: string) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const WEAPON_ICONS: Record<WeaponId | "bump", string> = {
  rockets: svg('<path d="M12 2c3 2 4 6 4 10l2 3-3 1-1 3h-4l-1-3-3-1 2-3c0-4 1-8 4-10z"/><circle cx="12" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M10 19l2 3 2-3"/>'),
  machinegun: svg('<path d="M2 11h13l3-3h4v5h-3l-2 2h-3l-1 5H9l1-5H2z"/><path d="M6 11v-3M10 11V8"/>'),
  mines: svg('<circle cx="12" cy="13" r="6"/><path d="M12 3v4M4.5 7.5l2.8 2.8M19.5 7.5l-2.8 2.8M3 13h4M17 13h4M12 20v2"/><circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none"/>'),
  bomb: svg('<circle cx="11" cy="14" r="7"/><path d="M14 8l2-3 3 1"/><circle cx="20" cy="4" r="1.3" fill="currentColor" stroke="none"/>'),
  shield: svg('<path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><path d="M9 12l2 2 4-4"/>'),
  boost: svg('<path d="M13 2L5 14h6l-1 8 9-13h-6z"/>'),
  seeker: svg('<path d="M4 18c3-1 5-4 6-8l2-6 3 1-1 6c-1 4 1 7 6 7"/><circle cx="15" cy="5" r="1.4" fill="currentColor" stroke="none"/><path d="M9 14l-2 3M6 12l-3 2"/>'),
  laser: svg('<path d="M3 12h11"/><path d="M14 9l7 3-7 3z" fill="currentColor"/><path d="M3 8l3 1M3 16l3-1"/>'),
  ice: svg('<path d="M12 2v20M4 7l16 10M4 17L20 7"/><path d="M12 2l-2 3M12 2l2 3M12 22l-2-3M12 22l2-3M4 7l3.5-.5M4 7l.5 3.5M20 17l-3.5.5M20 17l-.5-3.5M4 17l3.5.5M4 17l.5-3.5M20 7l-3.5-.5M20 7l-.5 3.5"/>'),
  slick: svg('<ellipse cx="12" cy="16" rx="9" ry="4"/><path d="M9 10c0-2 1.5-3.5 3-6 1.5 2.5 3 4 3 6a3 3 0 01-6 0z"/>'),
  shock: svg('<circle cx="12" cy="12" r="9"/><path d="M13 5l-5 8h4l-1 6 5-8h-4z" fill="currentColor"/>'),
  bump: svg('<path d="M4 12h5M15 12h5"/><circle cx="12" cy="12" r="3"/><path d="M9 7l-2-3M15 7l2-3M9 17l-2 3M15 17l2 3"/>'),
};

export const ICON_SOUND_ON = svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>');
export const ICON_SOUND_OFF = svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/>');
export const ICON_SKULL = svg('<path d="M12 3a8 8 0 00-8 8c0 2.6 1.3 4.7 3 6v4h10v-4c1.7-1.3 3-3.4 3-6a8 8 0 00-8-8z"/><circle cx="9" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.5" fill="currentColor" stroke="none"/><path d="M10 17h4"/>');

export const ICON_COIN = svg('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity="0.25"/><circle cx="12" cy="12" r="9"/><path d="M9.2 7.5v9M9.2 7.5h3.1a2.2 2.2 0 010 4.4H9.2M9.2 11.9h3.5a2.3 2.3 0 010 4.6H9.2" stroke-width="2.2"/>');
