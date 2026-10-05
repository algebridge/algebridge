import type { ReactNode } from "react";
import { units } from "@/data/curriculum";
import type { Unit } from "@/types";
import { unitHue } from "@/lib/hues";
import { unitMarkPaths } from "@/components/UnitMark";

/**
 * A certificate, drawn as one SVG on a letter page turned sideways (11 by
 * 8.5), so it prints edge to edge and saves as a picture from the same
 * drawing. Type is Georgia and the system sans, which every printer and the
 * picture export have; web fonts would quietly fall back in the export.
 *
 * A unit's certificate wears the unit's hue and its mark on the seal. The
 * course certificate is navy and gold, with a seal for each of the units in
 * a row along the bottom.
 */

const W = 1100;
const H = 850;
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const PAPER = "#fffdf8";
const INK = "#0f172a";
const MUTED = "#475569";

const NAVY = { solid: "#1e3a8a", deep: "#172554", line: "#c7d2fe", wash: "#eef2ff", onSolid: "#ffffff" };
const GOLD = "#b7862c";
const GOLD_LIGHT = "#e9c46a";

interface Palette {
  solid: string;
  deep: string;
  line: string;
  wash: string;
  onSolid: string;
  ink: string;
}

/** Splits "a · b · c" into lines of at most `max` characters, breaking only between items. */
function wrapItems(items: string[], max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    const next = line ? `${line}  ·  ${item}` : item;
    if (line && next.length > max) {
      lines.push(line);
      line = item;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A scalloped seal: a ring of beads around a disc, the way an embossed seal reads. */
function Seal({ cx, cy, r, fill, ring, children }: { cx: number; cy: number; r: number; fill: string; ring: string; children?: ReactNode }) {
  const beads = 28;
  return (
    <g>
      {Array.from({ length: beads }, (_, i) => {
        const a = (i / beads) * Math.PI * 2;
        return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={r * 0.14} fill={fill} />;
      })}
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx} cy={cy} r={r * 0.8} fill="none" stroke={ring} strokeWidth={1.6} opacity={0.85} />
      {children}
    </g>
  );
}

/** The two ribbon tails that hang below a seal. */
function Ribbons({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g fill={color}>
      <path d={`M${cx - 30} ${cy} L${cx - 46} ${cy + 66} L${cx - 33} ${cy + 57} L${cx - 22} ${cy + 70} L${cx - 8} ${cy + 6}Z`} />
      <path d={`M${cx + 30} ${cy} L${cx + 46} ${cy + 66} L${cx + 33} ${cy + 57} L${cx + 22} ${cy + 70} L${cx + 8} ${cy + 6}Z`} />
    </g>
  );
}

/** A unit's mark on the 24-grid, centered on (cx, cy) at `size` across. */
function Mark({ unitId, cx, cy, size, color, width = 1.7 }: { unitId: string; cx: number; cy: number; size: number; color: string; width?: number }) {
  const k = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`}
      fill="none"
      stroke={color}
      color={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {unitMarkPaths(unitId)}
    </g>
  );
}

/** Corner brackets just inside the inner frame. */
function Corners({ color }: { color: string }) {
  const m = 62;
  const len = 34;
  const d = [
    `M${m} ${m + len} V${m} H${m + len}`,
    `M${W - m - len} ${m} H${W - m} V${m + len}`,
    `M${W - m} ${H - m - len} V${H - m} H${W - m - len}`,
    `M${m + len} ${H - m} H${m} V${H - m - len}`,
  ].join(" ");
  return <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="square" />;
}

function nameSize(name: string): number {
  if (name.length > 32) return 36;
  if (name.length > 24) return 44;
  return 54;
}

/** The frame, paper and graph-paper ground every certificate shares. */
function Page({ id, palette, accent, children }: { id: string; palette: Palette; accent: string; children: ReactNode }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-grid`} width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke={palette.wash} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={PAPER} />
      <rect x="44" y="44" width={W - 88} height={H - 88} fill={`url(#${id}-grid)`} opacity="0.55" />
      <rect x="26" y="26" width={W - 52} height={H - 52} fill="none" stroke={palette.deep} strokeWidth="5" />
      <rect x="44" y="44" width={W - 88} height={H - 88} fill="none" stroke={accent} strokeWidth="1.5" />
      <Corners color={accent} />
      {children}
    </>
  );
}

/** Date on the left and the issuer on the right, each over a rule and a label. */
function Footer({ date, color }: { date: string; color: string }) {
  return (
    <g>
      <text x="245" y="712" textAnchor="middle" fontFamily={SERIF} fontSize="22" fill={INK}>
        {date}
      </text>
      <line x1="135" y1="726" x2="355" y2="726" stroke={color} strokeWidth="1.5" />
      <text x="245" y="750" textAnchor="middle" fontFamily={SANS} fontSize="12" letterSpacing="2.5" fill={MUTED}>
        DATE
      </text>
      <text x="855" y="712" textAnchor="middle" fontFamily={SERIF} fontSize="22" fill={INK}>
        AlgeBridge
      </text>
      <line x1="745" y1="726" x2="965" y2="726" stroke={color} strokeWidth="1.5" />
      <text x="855" y="750" textAnchor="middle" fontFamily={SANS} fontSize="12" letterSpacing="2.5" fill={MUTED}>
        ALGEBRA 1 · ALGEBRIDGE.ORG
      </text>
    </g>
  );
}

/** The student's name over its rule; a blank rule to write on when there is no name. */
function NameLine({ name, y, color }: { name: string; y: number; color: string }) {
  return (
    <g>
      {name && (
        <text x={W / 2} y={y} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={nameSize(name)} fill={INK}>
          {name}
        </text>
      )}
      <line x1="300" y1={y + 18} x2="800" y2={y + 18} stroke={color} strokeWidth="1.5" />
    </g>
  );
}

function Logo({ href, cx, y, size }: { href: string; cx: number; y: number; size: number }) {
  return <image href={href} x={cx - size / 2} y={y} width={size} height={size} />;
}

export function UnitCertificate({
  unit,
  name,
  date,
  logoHref = "/brand/logo-icon.png",
  className,
}: {
  unit: Unit;
  name: string;
  date: string;
  /** The logo's address; the picture export passes it inlined. */
  logoHref?: string;
  className?: string;
}) {
  const hue = unitHue(unit.id);
  const palette: Palette = { solid: hue.solid, deep: hue.deep, line: hue.line, wash: hue.wash, onSolid: hue.onSolid, ink: hue.ink };
  const skills = wrapItems(unit.skills.map((s) => s.title), 70);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Certificate of completion for Unit ${unit.number}, ${unit.title}${name ? `, awarded to ${name}` : ""}, ${date}`}
      className={className}
    >
      <Page id={`cert-${unit.id}`} palette={palette} accent={palette.solid}>
        <Logo href={logoHref} cx={W / 2} y={84} size={58} />
        <text x={W / 2} y="172" textAnchor="middle" fontFamily={SANS} fontSize="13" letterSpacing="5" fill={MUTED}>
          ALGEBRIDGE · ALGEBRA 1
        </text>
        <text x={W / 2} y="236" textAnchor="middle" fontFamily={SERIF} fontSize="48" fill={INK}>
          Certificate of Completion
        </text>
        <text x={W / 2} y="292" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={MUTED}>
          This certifies that
        </text>
        <NameLine name={name} y={372} color={palette.line} />
        <text x={W / 2} y="440" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={MUTED}>
          has finished every skill in
        </text>
        <text x={W / 2} y="496" textAnchor="middle" fontFamily={SERIF} fontSize="36" fill={palette.ink}>
          Unit {unit.number}: {unit.title}
        </text>
        {skills.map((line, i) => (
          <text key={line} x={W / 2} y={536 + i * 24} textAnchor="middle" fontFamily={SANS} fontSize="16" fill={MUTED}>
            {line}
          </text>
        ))}
        <Footer date={date} color={palette.line} />
        <Ribbons cx={W / 2} cy={700} color={palette.deep} />
        <Seal cx={W / 2} cy={690} r={56} fill={palette.solid} ring={palette.onSolid}>
          <Mark unitId={unit.id} cx={W / 2} cy={690} size={50} color={palette.onSolid} width={1.6} />
        </Seal>
      </Page>
    </svg>
  );
}

export function CourseCertificate({
  name,
  date,
  logoHref = "/brand/logo-icon.png",
  className,
}: {
  name: string;
  date: string;
  logoHref?: string;
  className?: string;
}) {
  const palette: Palette = { ...NAVY, ink: NAVY.solid };
  const skillCount = units.reduce((n, u) => n + u.skills.length, 0);
  // A seal per unit, in a row along the bottom: the whole course, in its colors.
  const step = 50;
  const left = W / 2 - ((units.length - 1) * step) / 2;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Certificate of achievement for finishing Algebra 1${name ? `, awarded to ${name}` : ""}, ${date}`}
      className={className}
    >
      <Page id="cert-course" palette={palette} accent={GOLD}>
        <Logo href={logoHref} cx={W / 2} y={78} size={62} />
        <text x={W / 2} y="170" textAnchor="middle" fontFamily={SANS} fontSize="13" letterSpacing="5" fill={GOLD}>
          ALGEBRIDGE
        </text>
        <text x={W / 2} y="234" textAnchor="middle" fontFamily={SERIF} fontSize="50" fill={NAVY.deep}>
          Certificate of Achievement
        </text>
        <text x={W / 2} y="288" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={MUTED}>
          This certifies that
        </text>
        <NameLine name={name} y={366} color={GOLD_LIGHT} />
        <text x={W / 2} y="432" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={MUTED}>
          has finished the whole course
        </text>
        <text x={W / 2} y="494" textAnchor="middle" fontFamily={SERIF} fontSize="46" fill={NAVY.solid}>
          Algebra 1
        </text>
        <text x={W / 2} y="530" textAnchor="middle" fontFamily={SANS} fontSize="15" letterSpacing="2" fill={MUTED}>
          {`ALL ${units.length} UNITS · ALL ${skillCount} SKILLS · FIVE RIGHT ON THE FIRST TRY IN EACH`}
        </text>
        {units.map((u, i) => {
          const hue = unitHue(u.id);
          const cx = left + i * step;
          return (
            <g key={u.id}>
              <circle cx={cx} cy={590} r={19} fill={hue.solid} />
              <Mark unitId={u.id} cx={cx} cy={590} size={22} color={hue.onSolid} width={1.8} />
            </g>
          );
        })}
        <Footer date={date} color={GOLD_LIGHT} />
        <Ribbons cx={W / 2} cy={706} color={NAVY.deep} />
        <Seal cx={W / 2} cy={696} r={52} fill={GOLD} ring="#fff7e0">
          <Logo href={logoHref} cx={W / 2} y={671} size={50} />
        </Seal>
      </Page>
    </svg>
  );
}

export const CERTIFICATE_SIZE = { width: W, height: H };
