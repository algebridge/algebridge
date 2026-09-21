import { units } from "@/data/curriculum";
import { UnitMark } from "@/components/UnitMark";
import { unitHue } from "@/lib/hues";

/**
 * The thirteen units as colored tiles, each with its mark: the whole course
 * at a glance, in the colors a student will meet unit by unit. "mosaic" is
 * three staggered columns for beside the hero text; "row" wraps for phones.
 */
export function UnitTiles({ variant }: { variant: "mosaic" | "row" }) {
  if (variant === "row") {
    return (
      <ul aria-label="The course's units" className="flex flex-wrap gap-1.5">
        {units.map((u) => (
          <Tile key={u.id} unitId={u.id} title={u.title} size={36} mark={18} />
        ))}
      </ul>
    );
  }
  const columns = [0, 1, 2].map((c) => units.filter((_, i) => i % 3 === c));
  return (
    <div aria-hidden className="flex items-center gap-2.5">
      {columns.map((column, c) => (
        <ul key={c} className={`flex flex-col gap-2.5 ${c === 1 ? "translate-y-7" : ""}`}>
          {column.map((u) => (
            <Tile key={u.id} unitId={u.id} title={u.title} size={50} mark={26} />
          ))}
        </ul>
      ))}
    </div>
  );
}

function Tile({ unitId, title, size, mark }: { unitId: string; title: string; size: number; mark: number }) {
  const hue = unitHue(unitId);
  return (
    <li
      title={title}
      style={{ width: size, height: size, backgroundColor: hue.solid, color: hue.onSolid }}
      className="flex items-center justify-center rounded-xl shadow-lg ring-1 ring-inset ring-white/15"
    >
      <UnitMark unitId={unitId} size={mark} />
    </li>
  );
}
