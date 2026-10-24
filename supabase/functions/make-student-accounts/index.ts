// Makes one student account for a teacher's class (Make accounts on the
// roster). The teacher's browser calls it once per student:
//
//   { classId, name, email?, username?, password }
//
// It runs as the signed-in teacher: the caller must be a teacher or admin who
// owns that class. The account is made with the admin API, already confirmed,
// so the project can keep "Confirm email" on for everyone else (a public
// sign-up is never auto-confirmed). A student without a school email gets
// <username>@students.algebridge.org, which nobody can receive mail at. The
// new account joins the class and is school-managed from its first moment.
import { createClient } from "npm:@supabase/supabase-js@2";

const USERNAME_DOMAIN = "students.algebridge.org";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const USERNAME = /^[a-z]+\.[a-z]+\d{4}$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "post only" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await asCaller.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!who.user) return reply({ error: "Sign in first." }, 401);

  let body: { classId?: string; name?: string; email?: string | null; username?: string | null; password?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }
  const name = (body.name ?? "").replace(/\s+/g, " ").trim();
  const password = body.password ?? "";
  const email = body.email ? body.email.trim().toLowerCase() : null;
  const username = body.username ? body.username.trim().toLowerCase() : null;
  if (!body.classId || !UUID.test(body.classId)) return reply({ error: "Bad request." }, 400);
  if (name.length < 3 || name.length > 80 || !name.includes(" ")) return reply({ error: "Give a first and last name." }, 400);
  if (password.length < 12 || password.length > 72) return reply({ error: "Bad request." }, 400);
  if (email ? !EMAIL.test(email) || email.endsWith(`@${USERNAME_DOMAIN}`) : !username || !USERNAME.test(username)) {
    return reply({ error: "Bad request." }, 400);
  }

  // The caller reads their own profile and classes under row security, so
  // these two reads answer "is this a teacher, and is it their class".
  const { data: me } = await asCaller.from("profiles").select("role").eq("id", who.user.id).maybeSingle();
  if (!me || !["teacher", "admin"].includes(me.role)) return reply({ error: "Only teachers can make accounts." }, 403);
  const { data: cls } = await asCaller.from("classes").select("id, teacher_id").eq("id", body.classId).maybeSingle();
  if (!cls || (cls.teacher_id !== who.user.id && me.role !== "admin")) return reply({ error: "That isn't your class." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: made, error } = await admin.auth.admin.createUser({
    email: email ?? `${username}@${USERNAME_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !made.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return reply({ error: taken ? "That email already has an account. Ask the student to join with the class code." : "The account could not be made." });
  }

  const id = made.user.id;
  await admin.from("profiles").update({ display_name: name, managed: true }).eq("id", id).eq("role", "student");
  const { error: joinError } = await admin.from("class_members").upsert({ class_id: cls.id, student_id: id }, { onConflict: "class_id,student_id", ignoreDuplicates: true });
  if (joinError) return reply({ id, error: "Made, but not added to the class." });
  return reply({ id, error: null });
});
