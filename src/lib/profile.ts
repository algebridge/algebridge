import { createClient } from "@/lib/supabase/client";
import { checkFullName } from "@/lib/name";

/**
 * Save the signed-in user's real name.
 *
 * Prefers the set_display_name RPC (which re-validates server-side and keeps
 * the leaderboard label in step). Falls back to a direct profile update on
 * databases where the classroom migration hasn't been run yet.
 */
export async function setDisplayName(rawName: string): Promise<string | null> {
  const check = checkFullName(rawName);
  if (!check.ok) return check.error;

  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";

  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return "You must be signed in.";

  const { error } = await supabase.rpc("set_display_name", { p_name: check.formatted });
  if (!error) return null;

  const missingRpc =
    error.code === "PGRST202" || /does not exist|could not find/i.test(error.message ?? "");
  if (!missingRpc) return error.message;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ display_name: check.formatted })
    .eq("id", me);
  if (updateError) return updateError.message;

  // Best-effort: keep the leaderboard label matching. A missing row here just
  // means the student hasn't synced stats yet.
  await supabase
    .from("leaderboard_stats")
    .update({ display_name: check.formatted })
    .eq("user_id", me);
  return null;
}
