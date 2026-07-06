import type { DiagramSpec } from "@/types";
import { NumberLineDiagram } from "@/components/visuals/NumberLineDiagram";
import { CoordinateGraphDiagram } from "@/components/visuals/CoordinateGraphDiagram";

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  if (spec.type === "number-line") return <NumberLineDiagram spec={spec} />;
  return <CoordinateGraphDiagram spec={spec} />;
}
