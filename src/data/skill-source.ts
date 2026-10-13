/**
 * Some Algebra 2 units are Algebra 1 units taught again (functions, systems,
 * factoring...). Each copy gets its own ids, "a2-" + the original id, so its
 * progress, path and pay belong to Algebra 2. Everything written once per
 * skill or unit (generators, checkers, videos, ideas, worked examples, rules,
 * standards, marks, hues) is looked up through the original id.
 */
export const COPY_PREFIX = "a2-";

/** The Algebra 1 id a copied skill or unit came from; any other id as is. */
export function sourceId(id: string): string {
  return id.startsWith(COPY_PREFIX) ? id.slice(COPY_PREFIX.length) : id;
}
