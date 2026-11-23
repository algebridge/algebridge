import { createClient } from "@/lib/supabase/client";
import type { Answers, SectionScore, TestResult } from "@/lib/tutor-test";

/**
 * Tutor check results, in `tutor_test_results`
 * (supabase/schema-2026-11-22-tutor-test.sql). Until that table exists the
 * page still grades and shows the score; it just says the result was not saved.
 */

export interface SavedResult {
  userId: string;
  name: string;
  score: number;
  total: number;
  passed: boolean;
  sections: SectionScore[];
  createdAt: string;
}

/** Saves one finished attempt. False when it could not be saved (table missing, signed out). */
export async function saveResult(result: TestResult, answers: Answers): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("tutor_test_results").insert({
    score: result.score,
    total: result.total,
    passed: result.passed,
    sections: result.sections,
    answers,
  });
  return !error;
}

type Row = { user_id: string; score: number; total: number; passed: boolean; sections: SectionScore[]; created_at: string };

/**
 * Attempts the reader can see, newest first: their own, or everyone's for an
 * admin (the table's policies decide which).
 */
export async function listResults(): Promise<SavedResult[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tutor_test_results")
    .select("user_id, score, total, passed, sections, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const rows = data as Row[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from("tutor_directory").select("id, display_name").in("id", ids);
    for (const p of people ?? []) if (p.display_name) names.set(p.id, p.display_name);
  }
  return rows.map((r) => ({
    userId: r.user_id,
    name: names.get(r.user_id) ?? "Tutor",
    score: r.score,
    total: r.total,
    passed: r.passed,
    sections: r.sections ?? [],
    createdAt: r.created_at,
  }));
}
