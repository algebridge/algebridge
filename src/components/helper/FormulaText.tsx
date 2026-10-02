import { Fragment, type ReactNode } from "react";

/**
 * A formula as a student would write it on paper: x2 and y1 as subscripts,
 * carets as raised powers, "+/-" as ±, sqrt as √, and " * " as a centred dot.
 * The cards are stored in plain keyboard text so the server and the tests can
 * read them; this is only how they are drawn.
 */
const TOKEN = /\^\(([^()]{1,12})\)|\^(-?\d+|[a-z])|\b([xy])([12])\b|\+\/-|sqrt|\s\*\s/g;

export function FormulaText({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > cursor) out.push(<Fragment key={key++}>{text.slice(cursor, at)}</Fragment>);
    const whole = m[0];
    if (m[1] !== undefined || m[2] !== undefined) {
      out.push(
        <sup key={key++} className="ml-px text-[0.7em] font-semibold">
          {(m[1] ?? m[2]).replace(/^-/, "−")}
        </sup>
      );
    } else if (m[3] !== undefined) {
      out.push(
        <Fragment key={key++}>
          {m[3]}
          <sub className="text-[0.7em]">{m[4]}</sub>
        </Fragment>
      );
    } else if (whole === "+/-") {
      out.push(<Fragment key={key++}>±</Fragment>);
    } else if (whole === "sqrt") {
      out.push(<Fragment key={key++}>√</Fragment>);
    } else {
      out.push(<Fragment key={key++}> · </Fragment>);
    }
    cursor = at + whole.length;
  }
  if (cursor < text.length) out.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  return <>{out}</>;
}
