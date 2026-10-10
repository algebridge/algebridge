import type { PracticeProblem } from "@/types";

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {};
