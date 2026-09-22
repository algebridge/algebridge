/**
 * Night, for both sides of the house: a moon where the sun was, a scatter
 * of stars, and the wash that darkens everything under them. The stars are
 * placed by a fixed table rather than a random draw, so the server and the
 * browser draw the same sky.
 */

export const nightWash = { fill: "#3b4a72", opacity: 0.62 } as const;

const STARS: [number, number, number][] = [
  [60, 40, 1.6], [130, 26, 1.2], [210, 70, 1.8], [290, 30, 1.1], [360, 96, 1.5], [430, 48, 1.2], [520, 22, 1.9],
  [590, 84, 1.3], [660, 40, 1.1], [730, 110, 1.7], [800, 30, 1.2], [880, 74, 1.5], [950, 20, 1.2], [1020, 92, 1.8],
  [1090, 52, 1.1], [1150, 118, 1.4], [240, 150, 1.0], [470, 170, 1.3], [700, 190, 1.0], [960, 160, 1.2], [1120, 210, 1.1],
  [90, 220, 1.2], [340, 240, 1.0], [640, 250, 1.3], [840, 236, 1.1], [1180, 300, 1.0], [30, 320, 1.1],
];

export function NightSky({ uid, moon }: { uid: string; moon: { x: number; y: number } }) {
  return (
    <g>
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={i % 3 === 0 ? 0.95 : 0.7} />
      ))}
      <circle cx={moon.x} cy={moon.y} r="64" fill="#ffffff" opacity="0.12" />
      <circle cx={moon.x} cy={moon.y} r="34" fill="#fef9c3" />
      <circle cx={moon.x + 12} cy={moon.y - 6} r="30" fill="#0f1730" opacity="0.0" />
      <circle cx={moon.x - 10} cy={moon.y + 6} r="5" fill="#fde68a" opacity="0.6" />
      <circle cx={moon.x + 8} cy={moon.y - 10} r="3.5" fill="#fde68a" opacity="0.6" />
      <title>{uid}</title>
    </g>
  );
}
