// End-to-end test of supabase/schema-2026-11-03-hardening.sql in PGlite
// (Postgres 17 on wasm), the way the earlier safety migrations were proved:
// every live schema file in the order it was applied, with the Supabase
// pieces they lean on stubbed (auth.uid(), the roles, realtime.messages and
// realtime.topic(), storage), then seeded with the kinds of rows the live
// database holds (school accounts, old email-prefix names, a junk name on the
// leaderboard, a forged bot, ticker rows with a phone number), then the new
// file TWICE, then a check of every rule as the roles the app uses.
//
// PGlite is not one of the app's dependencies. Install it anywhere outside
// the repo and point at it:
//   (mkdir -p ~/pglite && cd ~/pglite && npm i @electric-sql/pglite@0.3.15)
//   PGLITE_DIR=~/pglite/node_modules node scripts/test-hardening-2026-11-03.mjs
// Nothing here talks to the live project.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPA = path.join(ROOT, "supabase");

let PGlite;
try {
  const dir = process.env.PGLITE_DIR;
  ({ PGlite } = dir
    ? await import(pathToFileURL(path.join(dir, "@electric-sql/pglite/dist/index.js")).href)
    : await import("@electric-sql/pglite"));
} catch {
  console.error("PGlite not found. See the comment at the top of this file.");
  process.exit(2);
}

// The live files, in the order they were applied: the order they were first
// committed (git log --diff-filter=A), except the Oct 3 safety file.
const LIVE = [
  "schema.sql",
  "schema-tutors.sql",
  "schema-admin-groups.sql",
  "schema-hardening.sql",
  "schema-classroom.sql",
  "schema-admin-console.sql",
  "schema-helper.sql",
  "schema-story-templates.sql",
  "schema-safety-2026-09.sql",
  "schema-feedback.sql",
  "schema-2026-09-22.sql",
  "schema-2026-10-01-reviews.sql",
  "schema-2026-10-05-console.sql",
  "schema-2026-10-07-push.sql",
  "schema-2026-10-08-neighbours.sql",
  "schema-2026-10-09-street.sql",
  "schema-2026-10-11-city-plots.sql",
  // Written Oct 3, applied Oct 11 (remote version 20261011120000), after the street's files.
  "schema-2026-10-03-safety.sql",
  "schema-2026-10-11-leaderboard-on.sql",
  "schema-2026-10-14-leaderboard-backfill.sql",
  "schema-2026-10-14-leaderboard-merge.sql",
  "schema-2026-10-15-class-controls.sql",
  "schema-2026-10-22-teacher-password-reset.sql",
  "schema-2026-10-26-interests.sql",
  "schema-2026-10-27-insights.sql",
  "schema-2026-10-31-carts-leaderboard.sql",
  "schema-2026-11-02-activity-ticker.sql",
  "schema-2026-11-02-activity-backfill.sql",
];
const NEW = "schema-2026-11-03-hardening.sql";

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema realtime;
create schema storage;
create schema extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table auth.identities (user_id uuid, provider text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as
  $$ select nullif(current_setting('realtime.topic', true), '') $$;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
grant usage on schema public, auth, realtime, storage, extensions to anon, authenticated, service_role;
grant select, insert on realtime.messages to anon, authenticated;
grant usage, select on all sequences in schema realtime to anon, authenticated;
-- Supabase's default privileges: every new table and function in public is
-- granted to the API roles, and row security decides.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const db = new PGlite();
let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('realtime.topic', '', false);`);
}
/** Runs one statement as a signed-in account (uid), or as anon (uid null). */
async function as(uid, sql, params = [], topic = null) {
  await reset();
  await db.exec(
    `select set_config('request.jwt.claim.sub', ${q(uid ?? "")}, false);` +
      (topic ? `select set_config('realtime.topic', ${q(topic)}, false);` : "") +
      `set role ${uid ? "authenticated" : "anon"};`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await reset();
  }
}
async function asRole(role, sql) {
  await reset();
  await db.exec(`set role ${role};`);
  try {
    return await db.query(sql);
  } finally {
    await reset();
  }
}
async function fails(promise, re) {
  try {
    await promise;
    return { failed: false, message: "no error" };
  } catch (e) {
    return { failed: re.test(e.message), message: e.message };
  }
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const val = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0] ?? {})[0];

// ---- 1. The live schema -------------------------------------------------
await db.exec(STUBS);
for (const f of LIVE) {
  const sql = readFileSync(path.join(SUPA, f), "utf8").replace(/create extension if not exists pgcrypto;/gi, "");
  try {
    await db.exec(sql);
  } catch (e) {
    console.error(`Loading ${f} failed: ${e.message}`);
    process.exit(1);
  }
}
console.log(`Loaded ${LIVE.length} live schema files.`);

// ---- 2. Rows like the live ones -----------------------------------------
async function user(email, fullName) {
  const meta = fullName ? JSON.stringify({ full_name: fullName }) : "{}";
  return val(`insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`, [email, meta]);
}
const A = await user("ava@example.test", "Ava Stone");
const B = await user("ben@example.test", "Ben Carter");
const M = await user("mia@example.test", "Mia Lopez"); // school-managed
const O = await user("omar@example.test", "Omar Diaz"); // hidden from the leaderboard
const L = await user("sam2011x@example.test", null); // an old account: email prefix as its name
const T = await user("tia@example.test", "Tia Teacher");
const J1 = await user("jacob1@example.test", "Jacob Smith");
const J2 = await user("jacob2@example.test", "Jacob Smith"); // the same student's second account
const Z1 = await user("zack@example.test", "Zack Balan"); // linked by hand to 'zach balan'
const Z2 = await user("zach@example.test", "Zach Balan");
const C = await user("cara@example.test", "Cara Brook"); // in a class whose teacher turned games off
const E = await user("eve@example.test", "Eve Hacker");
const R = await user("rita@example.test", "Rita Moreno"); // claims the teacher role with the right code

await db.exec(`
  update public.profiles set managed = true where id = ${q(M)};
  update public.profiles set role = 'teacher' where id = ${q(T)};
  update public.role_codes set code = 'REAL-teacher-code' where role = 'teacher';
`);
const cls = await val(`insert into public.classes (teacher_id, name) values ($1, 'Period 1') returning id`, [T]);
await db.query(`insert into public.class_members (class_id, student_id) values ($1, $2)`, [cls, C]);
await db.query(`insert into public.class_controls (class_id, blocked_features) values ($1, '{games}')`, [cls]);

const board = [
  [A, "Ava S.", 120, true],
  [B, "Ben C.", 80, true],
  [M, "Mia L.", 300, true],
  [O, "Omar D.", 90, false],
  [L, "Sam2011x", 40, true],
  [J1, "Jacob S.", 50, true],
  [J2, "Jacob S.", 25, true],
  [Z1, "Zack B.", 1648, true],
  [Z2, "Zach B.", 100, true],
  [E, "visit evil.com 302 555 0142", 10, true],
];
for (const [id, name, bridgeys, optIn] of board) {
  await db.query(
    `insert into public.leaderboard_stats (user_id, display_name, bridgeys, leaderboard_opt_in, updated_at) values ($1, $2, $3, $4, now() - interval '1 hour')`,
    [id, name, bridgeys, optIn],
  );
}
await db.query(`insert into public.leaderboard_links (user_id, person_key, note) values ($1, 'zach balan', 'by hand')`, [Z1]);

await db.query(
  `insert into public.activity_feed (user_id, first_name, kind, amount, detail, at) values
     ($1, 'Mia', 'solved', null, null, now() - interval '1 hour'),
     ($2, 'Ava', 'skill', null, 'Call me 302 555 0142', now() - interval '1 hour'),
     ($2, 'Ava', 'skill', null, 'Two-Step Equations', now() - interval '50 minutes'),
     ($3, 'Sam2011x', 'solved', null, null, now() - interval '40 minutes'),
     ($4, 'Ben', 'bought', null, 'Lava Lamp', now() - interval '30 minutes'),
     ($5, 'Omar', 'solved', null, null, now() - interval '20 minutes')`,
  [M, A, L, B, O],
);

await db.query(
  `insert into public.carts_leaderboard (key, user_id, name, is_bot, smashes, wins, matches) values
     ('b:Ava K.', null, 'Ava K.', true, 100, 3, 10),
     ('b:Visit evil.com', null, 'Visit evil.com', true, 999, 9, 9),
     ($1, $2, 'Ava S.', false, 5, 1, 2),
     ($3, $4, 'Mia L.', false, 50, 5, 6),
     ($5, $6, 'www.evil.com', false, 7, 0, 1),
     ($7, $8, 'Omar D.', false, 30, 2, 3)`,
  [`u:${A}`, A, `u:${M}`, M, `u:${E}`, E, `u:${O}`, O],
);

await db.query(
  `insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
     ('https://push.example.test/a1', $1, 'k', 'a'), ('https://push.example.test/b1', $2, 'k', 'a')`,
  [A, B],
);

// The board before: the two Jacob Smith accounts are one row, and so are Zack and Zach.
const before = (await as(A, `select display_name, bridgeys from public.leaderboard_public order by display_name`)).rows;

// ---- 3. The new file, twice ---------------------------------------------
const hardening = readFileSync(path.join(SUPA, NEW), "utf8");
async function snapshot() {
  return one(`select
    (select count(*) from public.ticker_titles) as titles,
    (select count(*) from public.leaderboard_links) as links,
    (select count(*) from pg_policies where schemaname = 'realtime' and policyname like 'Alge Carts lobbies%') as lobby_policies,
    (select count(*) from pg_policies where tablename = 'carts_leaderboard') as carts_policies,
    (select count(*) from pg_trigger where tgname in ('guard_carts_row', 'guard_profile_display_name', 'leaderboard_name_from_profile', 'board_names_follow_profile')) as triggers,
    (select count(*) from pg_proc where proname = 'claim_role') as claim_role_fns,
    (select count(*) from public.activity_feed) as feed,
    (select count(*) from public.carts_leaderboard) as carts`);
}
let report;
try {
  const results = await db.exec(hardening);
  report = results[results.length - 1]?.rows;
} catch (e) {
  console.error(`First apply failed: ${e.message}`);
  process.exit(1);
}
const first = await snapshot();
check("first apply ran on rows like the live ones", true);

// Between the two runs, someone renames themselves to a classmate's name. The
// second run must not turn that into a link (the name merge is copied once).
await as(E, `select public.set_display_name('Jacob Smith')`);

try {
  await db.exec(hardening);
} catch (e) {
  console.error(`Second apply failed: ${e.message}`);
  process.exit(1);
}
const second = await snapshot();
check(
  "second apply is a no-op (titles, links, policies, triggers, functions, rows)",
  JSON.stringify(first) === JSON.stringify(second),
  `${JSON.stringify(first)} vs ${JSON.stringify(second)}`,
);
check("one claim_role, returning json", second.claim_role_fns === 1 && (await val(`select format_type(prorettype, null) from pg_proc where proname = 'claim_role'`)) === "json");
await as(E, `select public.set_display_name('Eve Hacker')`);

// ---- 4. Alge Carts lobbies (realtime.messages) --------------------------
await db.exec(`insert into realtime.messages (topic, extension, payload) values
  ('carts-lobby-3', 'presence', '{}'), ('carts-lobbies', 'presence', '{}'), ('carts-lobby-3', 'broadcast', '{}')`);
const send = (uid, topic, ext = "broadcast") =>
  as(uid, `insert into realtime.messages (topic, extension, payload) values ($1, $2, '{"k":"snap"}')`, [topic, ext], topic);
const seen = async (uid, topic) =>
  Number((await as(uid, `select count(*)::int as n from realtime.messages where topic = $1`, [topic], topic)).rows[0].n);

check("signed in: tracks presence on carts-lobbies", !(await fails(send(A, "carts-lobbies", "presence"), /.*/)).failed);
check("signed in: broadcasts on carts-lobby-3", !(await fails(send(A, "carts-lobby-3"), /.*/)).failed);
check("signed in: reads carts-lobby-3 (presence and broadcast)", (await seen(A, "carts-lobby-3")) >= 2);
check("anon: cannot broadcast on carts-lobby-3", (await fails(send(null, "carts-lobby-3"), /row-level security/)).failed);
check("anon: cannot track presence on carts-lobbies", (await fails(send(null, "carts-lobbies", "presence"), /row-level security/)).failed);
check("anon: reads nothing on carts-lobby-3", (await seen(null, "carts-lobby-3")) === 0);
check("signed in: refused on a made-up topic carts-lobby-x1", (await fails(send(A, "carts-lobby-x1"), /row-level security/)).failed);
check("signed in: refused on carts-lobby-0", (await fails(send(A, "carts-lobby-0"), /row-level security/)).failed);
check("signed in: refused for another extension (postgres_changes)", (await fails(send(A, "carts-lobby-3", "postgres_changes"), /row-level security/)).failed);
check("school-managed student: may race (games are the teacher's call)", !(await fails(send(M, "carts-lobby-3"), /.*/)).failed);
check("student whose teacher turned games off: refused", (await fails(send(C, "carts-lobby-3"), /row-level security/)).failed);
check("student whose teacher turned games off: reads nothing", (await seen(C, "carts-lobby-3")) === 0);
check("call rooms keep their own rule (a stranger's room refused)", (await fails(send(A, `room-${B}--${T}`), /row-level security/)).failed);

// ---- 5. The Alge Carts board ---------------------------------------------
const cart = async (key) => one(`select * from public.carts_leaderboard where key = $1`, [key]);
check("a forged bot row already stored is deleted", !(await cart("b:Visit evil.com")));
check("a real bot row already stored stays", !!(await cart("b:Ava K.")));
check("a student's stored row takes the profile's name", (await cart(`u:${E}`))?.name === "Eve H.");

const upsertCart = (uid, row) =>
  as(
    uid,
    `insert into public.carts_leaderboard (key, user_id, name, is_bot, smashes, wins, matches, best_streak, xp)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (key) do update set user_id = excluded.user_id, name = excluded.name, is_bot = excluded.is_bot,
       smashes = excluded.smashes, wins = excluded.wins, matches = excluded.matches, best_streak = excluded.best_streak, xp = excluded.xp`,
    [row.key, row.user_id ?? null, row.name, row.is_bot ?? false, row.smashes ?? 0, row.wins ?? 0, row.matches ?? 0, row.best_streak ?? 0, row.xp ?? 0],
  );
await upsertCart(B, { key: `u:${B}`, user_id: B, name: "Free robux at evil.com", smashes: 12, wins: 1, matches: 3 });
check("own row: a forged name is replaced by the profile's First L.", (await cart(`u:${B}`))?.name === "Ben C.");
await upsertCart(M, { key: `u:${M}`, user_id: M, name: "Mia L.", smashes: 999, wins: 9, matches: 9 });
check("school-managed student: own row is not written", (await cart(`u:${M}`))?.smashes === 50);
await upsertCart(O, { key: `u:${O}`, user_id: O, name: "Omar D.", smashes: 999, wins: 9, matches: 9 });
check("student hidden from the leaderboard: own row is not written", (await cart(`u:${O}`))?.smashes === 30);
await upsertCart(E, { key: "b:Visit evil.com", name: "Visit evil.com", is_bot: true, smashes: 5, matches: 1 });
check("bot row with a name the game never uses: refused", !(await cart("b:Visit evil.com")));
await upsertCart(E, { key: "b:Free Robux N.", name: "Free Robux N.", is_bot: true, smashes: 5, matches: 1 });
check("bot row with a First L. name not on the list: refused", !(await cart("b:Free Robux N.")));
await upsertCart(E, { key: "b:Mason R2.", name: "Mason R2.", is_bot: true, smashes: 9999, wins: 50, matches: 50, best_streak: 500, xp: 999999 });
const r2 = await cart("b:Mason R2.");
check("a lobby-7 bot name (Mason R2.) is accepted, held to one match", r2?.smashes === 60 && r2?.matches === 1 && r2?.wins === 1 && r2?.best_streak === 60 && r2?.xp === 940, JSON.stringify(r2));
await upsertCart(E, { key: "b:Ava K.", name: "Ava K.", is_bot: true, smashes: 100000, wins: 400, matches: 400, best_streak: 9, xp: 5 });
const ak = await cart("b:Ava K.");
check("an existing bot gains at most one match (100 -> 160 smashes, 10 -> 11 matches)", ak?.smashes === 160 && ak?.matches === 11 && ak?.wins === 4, JSON.stringify(ak));
await upsertCart(A, { key: "b:Ava K.", name: "Ava K.", is_bot: true, smashes: 165, wins: 4, matches: 12, best_streak: 3, xp: 2000 });
check("a host's honest bot update goes through (165 smashes, 12 matches)", (await cart("b:Ava K."))?.smashes === 165 && (await cart("b:Ava K."))?.matches === 12);
const renamed = await fails(as(E, `update public.carts_leaderboard set name = 'Evil Bot' where key = 'b:Ava K.'`), /.*/);
check("a bot cannot be renamed", (await cart("b:Ava K."))?.name === "Ava K.", renamed.message);
await as(
  A,
  `insert into public.carts_leaderboard (key, user_id, name, is_bot, smashes, wins, matches)
   values ('b:Ava K.', null, 'Ava K.', true, 170, 4, 13), ('b:Mason R. 8', null, 'Mason R. 8', true, 3, 0, 1)
   on conflict (key) do update set smashes = excluded.smashes, wins = excluded.wins, matches = excluded.matches`,
);
check("a host's batch with one odd bot: the rest is stored, the odd one skipped, no error", (await cart("b:Ava K."))?.smashes === 170 && !(await cart("b:Mason R. 8")));

const boardRes = await as(A, `select * from public.carts_board(60)`);
const cols = boardRes.fields.map((f) => f.name).join(",");
check("carts_board() columns: rank, name, is_bot, numbers, is_me; no user_id or key", cols === "rank,name,is_bot,smashes,wins,matches,best_streak,xp,is_me", cols);
const names = boardRes.rows.map((r) => r.name);
check("carts_board() leaves out the school account and the hidden student", !names.includes("Mia L.") && !names.includes("Omar D."), names.join("|"));
check("carts_board() marks the reader's own row", boardRes.rows.some((r) => r.is_me && r.name === "Ava S.") && boardRes.rows.filter((r) => r.is_me).length === 1);
check("carts_board() has the bots", boardRes.rows.some((r) => r.is_bot && r.name === "Ava K."));
const direct = (await as(A, `select key, user_id from public.carts_leaderboard`)).rows;
check("the table itself shows a student only their own row and the bots", direct.every((r) => r.user_id === null || r.user_id === A) && direct.some((r) => r.user_id === A), JSON.stringify(direct.map((r) => r.key)));
check("anon cannot read carts_board()", (await fails(as(null, `select * from public.carts_board()`), /permission denied/)).failed);

// ---- 6. The activity ticker ----------------------------------------------
const feed = async () => (await db.query(`select user_id, first_name, kind, detail from public.activity_feed order by id`)).rows;
let rows = await feed();
check("stored ticker rows from a school account are deleted", !rows.some((r) => r.user_id === M));
check("a stored ticker row with a phone number is deleted", !rows.some((r) => /555/.test(r.detail ?? "")));
check("a stored ticker row from an account without a real name is deleted", !rows.some((r) => r.user_id === L));
check("good stored ticker rows stay", rows.some((r) => r.detail === "Two-Step Equations") && rows.some((r) => r.detail === "Lava Lamp"));

const post = (uid, kind, detail = null, amount = null) =>
  as(uid, `select public.post_activity($1, $2, $3)`, [kind, amount, detail]);
await post(A, "skill", "Call me 302 555 0142");
await post(B, "bought", "Visit www.evil.com");
await post(J1, "skill", "Two-Step Equations");
rows = await feed();
check("a ticker detail with a phone number never reaches the feed", !rows.some((r) => /302|555/.test(r.detail ?? "")) && rows.some((r) => r.user_id === A && r.kind === "skill" && r.detail === null));
check("a ticker detail with a web address never reaches the feed", !rows.some((r) => /evil/.test(r.detail ?? "")) && rows.some((r) => r.user_id === B && r.kind === "bought" && r.detail === null));
check("a real skill title is kept", rows.some((r) => r.user_id === J1 && r.detail === "Two-Step Equations"));
const nBefore = rows.length;
const oBefore = rows.filter((r) => r.user_id === O).length;
await post(M, "solved");
await post(L, "solved");
await post(O, "solved");
rows = await feed();
check("school-managed account: refused on the ticker", !rows.some((r) => r.user_id === M));
check("account whose name is an old email prefix: refused on the ticker", !rows.some((r) => r.user_id === L));
check("student hidden from the leaderboard: refused on the ticker", rows.filter((r) => r.user_id === O).length === oBefore && rows.length === nBefore);
await db.query(
  `insert into public.activity_feed (user_id, first_name, kind, at)
   select $1, 'Zack', 'solved', now() - (s * interval '8 seconds') from generate_series(1, 6) s`,
  [Z1],
);
await db.query(
  `insert into public.activity_feed (user_id, first_name, kind, at)
   select $1, 'Zach', 'solved', now() - (s * interval '9 seconds') from generate_series(1, 5) s`,
  [Z2],
);
const zBefore = Number(await val(`select count(*) from public.activity_feed where user_id = $1`, [Z1]));
await post(Z1, "solved");
check("a seventh moment within a minute is dropped", Number(await val(`select count(*) from public.activity_feed where user_id = $1`, [Z1])) === zBefore);
const z2Before = Number(await val(`select count(*) from public.activity_feed where user_id = $1`, [Z2]));
await post(Z2, "solved");
check("a sixth moment within a minute is kept", Number(await val(`select count(*) from public.activity_feed where user_id = $1`, [Z2])) === z2Before + 1);
const recent = await as(B, `select * from public.recent_activity(0, 100)`);
check("recent_activity() columns unchanged", recent.fields.map((f) => f.name).join(",") === "id,at,first_name,kind,amount,detail");
check("recent_activity() shows no school account and no hidden student", !recent.rows.some((r) => ["Mia", "Omar"].includes(r.first_name)));
check("recent_activity() shows only known titles", recent.rows.every((r) => r.detail === null || ["Two-Step Equations", "Lava Lamp"].includes(r.detail)));
await db.query(`update public.leaderboard_stats set leaderboard_opt_in = false where user_id = $1`, [B]);
check("a student who hides from the leaderboard leaves the strip at once", !(await as(A, `select * from public.recent_activity(0, 100)`)).rows.some((r) => r.first_name === "Ben"));
await db.query(`update public.leaderboard_stats set leaderboard_opt_in = true where user_id = $1`, [B]);

// ---- 7. Display names ----------------------------------------------------
const setName = (uid, name) => as(uid, `update public.profiles set display_name = $1 where id = $2`, [name, uid]);
const nameOf = async (id) => val(`select display_name from public.profiles where id = $1`, [id]);
let r = await fails(setName(B, "Visit www.evil.com"), /letters only/);
check("direct update: a web address is refused", r.failed, r.message);
r = await fails(setName(B, `${"a".repeat(5000)} Smith`), /3-60 characters/);
check("direct update: a 5,000-character name is refused", r.failed, r.message);
r = await fails(setName(B, "Benny 302 555 0142 Carter"), /numbers/);
check("direct update: digits (a phone number) are refused", r.failed, r.message);
await setName(B, "Ben 302 555 0142 Carter");
check("direct update: junk that tidies back to the stored name stores nothing new", (await nameOf(B)) === "Ben Carter");
r = await fails(setName(B, "Ben bencarter@mail.com"), /numbers, usernames or email/);
check("direct update: an email address is refused", r.failed, r.message);
r = await fails(setName(B, "snapchat:benny Carter"), /letters only/);
check("direct update: a username with a colon is refused", r.failed, r.message);
r = await fails(setName(B, "Ben C."), /full last name/);
check("direct update: a last initial is refused", r.failed, r.message);
check("refused updates left the name alone", (await nameOf(B)) === "Ben Carter");
await setName(B, "ben carter-jones");
check("direct update: a real name is accepted and tidied", (await nameOf(B)) === "Ben Carter-Jones");
await setName(B, "José Núñez");
check("direct update: accented letters are fine", (await nameOf(B)) === "José Núñez");
check(
  "a rename on the profile page reaches both boards at once",
  (await val(`select display_name from public.leaderboard_stats where user_id = $1`, [B])) === "José N." &&
    (await val(`select name from public.carts_leaderboard where key = $1`, [`u:${B}`])) === "José N.",
);
await as(L, `insert into public.profiles (id, display_name, bio) values ($1, $2, 'I like math') on conflict (id) do update set display_name = excluded.display_name, bio = excluded.bio`, [L, await nameOf(L)]);
check("profile page: an old account saves its bio with its old name unchanged", (await val(`select bio from public.profiles where id = $1`, [L])) === "I like math");
r = await fails(as(L, `insert into public.profiles (id, display_name) values ($1, 'xX_gamer 2011') on conflict (id) do update set display_name = excluded.display_name`, [L]), /numbers/);
check("profile page (upsert): a junk name is refused", r.failed, r.message);
r = await fails(as(B, `select public.set_display_name('www.evil.com smith')`), /letters only/);
check("set_display_name: a web address is refused (the guard covers the RPC too)", r.failed, r.message);
await as(B, `select public.set_display_name('Ben Carter')`);
check("set_display_name: a real name still works", (await nameOf(B)) === "Ben Carter");
check("set_display_name keeps the leaderboard name in step", (await val(`select display_name from public.leaderboard_stats where user_id = $1`, [B])) === "Ben C.");
await asRole("service_role", `update public.profiles set display_name = 'Maria A.' where id = '${R}'`);
check("service role (teacher-made accounts) is not blocked", (await nameOf(R)) === "Maria A");
await db.query(`update public.profiles set display_name = 'Rita Moreno' where id = $1`, [R]);
const junkSignup = await user("junk@example.test", "xX_gamer 555");
check("a signup is never blocked by the name rule", !!(await nameOf(junkSignup)));

check("a junk name already on the leaderboard is replaced by the profile's", (await val(`select display_name from public.leaderboard_stats where user_id = $1`, [E])) === "Eve H.");
await as(E, `insert into public.leaderboard_stats (user_id, display_name, bridgeys, leaderboard_opt_in) values ($1, 'Free robux 302 555 0142', 10, true)
             on conflict (user_id) do update set display_name = excluded.display_name, bridgeys = excluded.bridgeys`, [E]);
check("leaderboard_stats: a name written by the app is replaced by the profile's First L.", (await val(`select display_name from public.leaderboard_stats where user_id = $1`, [E])) === "Eve H.");
check("leaderboard_stats: an old email-prefix name with digits shows as Anonymous Student", (await val(`select display_name from public.leaderboard_stats where user_id = $1`, [L])) === "Anonymous Student");

const pub = await as(A, `select * from public.leaderboard_public order by display_name`);
check("leaderboard_public has no user_id", !pub.fields.some((f) => f.name === "user_id"));
const after = pub.rows.map((x) => ({ display_name: x.display_name, bridgeys: x.bridgeys }));
const pick = (list, name) => list.filter((x) => x.display_name === name).map((x) => x.bridgeys).join(",");
check("the two Jacob Smith accounts are still one row (75 Bridgeys)", pick(before, "Jacob S.") === "75" && pick(after, "Jacob S.") === "75", `${pick(before, "Jacob S.")} -> ${pick(after, "Jacob S.")}`);
check("Zack and Zach (one by link, one by name) are still one row", after.filter((x) => /^Za(ck|ch) B\.$/.test(x.display_name)).length === 1 && after.some((x) => x.bridgeys === 1748));
check(
  "links were written for the accounts combined by name, and only those",
  Number(await val(`select count(*) from public.leaderboard_links where note = 'Combined by name until 2026-11-03'`)) === 3 &&
    Number(await val(`select count(*) from public.leaderboard_links where user_id in ($1, $2, $3)`, [J1, J2, Z2])) === 3,
);
check("a rename between the two runs was not turned into a link", !(await one(`select 1 from public.leaderboard_links where user_id = $1`, [E])));
await as(E, `select public.set_display_name('Ava Stone')`);
const imp = (await as(A, `select display_name, bridgeys, is_me from public.leaderboard_public`)).rows;
const mine = imp.filter((x) => x.is_me);
check("renaming yourself to a classmate's name no longer joins their row", mine.length === 1 && mine[0].bridgeys === 120, JSON.stringify(mine));
await as(E, `select public.set_display_name('Eve Hacker')`);

// ---- 8. Floods -----------------------------------------------------------
const today = await val(`select public.traffic_today()::text`);
const v1 = "11111111-1111-4111-8111-111111111111";
const v2 = "22222222-2222-4222-8222-222222222222";
await as(null, `select public.record_visit('app', $1, '/learn')`, [v1]);
check("record_visit: a visit is counted", Number(await val(`select views from public.traffic_visitors where visitor = $1`, [v1])) === 1);
await db.query(`update public.write_budget set n = 50000 where bucket = 'visitors:app' and day = $1`, [today]);
await as(null, `select public.record_visit('app', $1, '/learn')`, [v2]);
check("record_visit: past 50,000 new visitors in a day, a new one is not counted", !(await one(`select 1 from public.traffic_visitors where visitor = $1`, [v2])));
await as(null, `select public.record_visit('app', $1, '/learn')`, [v1]);
check("record_visit: a visitor already counted today keeps counting", Number(await val(`select views from public.traffic_visitors where visitor = $1`, [v1])) === 2);
await db.query(`insert into public.traffic_events (day, site, name, label, n) select $1::date, 'app', 'cta_click', 'label-' || g, 1 from generate_series(1, 200) g`, [today]);
await as(null, `select public.record_event('app', $1, 'cta_click', 'brand-new-label')`, [v1]);
check("record_event: past 200 labels in a day, a new label counts as (other)", !(await one(`select 1 from public.traffic_events where label = 'brand-new-label'`)) && Number(await val(`select n from public.traffic_events where label = '(other)'`)) === 1);
await as(null, `select public.record_learning_event($1, 'student', 'problem_attempt')`, [v1]);
check("record_learning_event: a fact is stored", Number(await val(`select count(*) from public.learning_events`)) === 1);
await db.query(`update public.write_budget set n = 300000 where bucket = 'learning_events' and day = $1`, [today]);
await as(null, `select public.record_learning_event($1, 'student', 'problem_attempt')`, [v2]);
check("record_learning_event: past 300,000 facts in a day, the rest are dropped", Number(await val(`select count(*) from public.learning_events`)) === 1);
check("write_budget is not readable through the API", (await fails(as(A, `select * from public.write_budget`), /permission denied/)).failed);

async function claim(uid, role, code) {
  return db.transaction(async (tx) => {
    await tx.exec(`select set_config('request.jwt.claim.sub', ${q(uid)}, true); set local role authenticated;`);
    const res = await tx.query(`select public.claim_role($1, $2) as j`, [role, code]);
    const status = (await tx.query(`select current_setting('response.status', true) as s`)).rows[0].s;
    return { j: res.rows[0].j, status };
  });
}
let wrongOk = true;
for (let i = 0; i < 5; i += 1) {
  const res = await claim(B, "teacher", `guess-${i}`);
  wrongOk = wrongOk && res.status === "400" && /not valid for the teacher role/.test(res.j?.message ?? "");
}
await reset();
check("claim_role: a wrong code answers 400 with the error body the app reads", wrongOk);
check("claim_role: the wrong codes are remembered (not rolled back)", Number(await val(`select count(*) from public.role_code_attempts where user_id = $1`, [B])) === 5);
r = await fails(claim(B, "teacher", "REAL-teacher-code"), /Too many wrong access codes/);
await reset();
check("claim_role: after 5 wrong codes in an hour, even the right one waits", r.failed, r.message);
check("claim_role: the account stayed a student", (await val(`select role from public.profiles where id = $1`, [B])) === "student");
const right = await claim(R, "teacher", "REAL-teacher-code");
await reset();
check("claim_role: the right code still makes a teacher", right.j === "teacher" && right.status !== "400" && (await val(`select role from public.profiles where id = $1`, [R])) === "teacher");
check("claim_role: anon cannot call it", (await fails(as(null, `select public.claim_role('teacher', 'x')`), /permission denied/)).failed);

// ---- 9. Push devices ----------------------------------------------------
await as(B, `select public.forget_push_endpoint('https://push.example.test/a1')`);
check("forget_push_endpoint: someone else's device is not deleted", !!(await one(`select 1 from public.push_subscriptions where endpoint = 'https://push.example.test/a1'`)));
await as(A, `select public.forget_push_endpoint('https://push.example.test/a1')`);
check("forget_push_endpoint: your own device is deleted", !(await one(`select 1 from public.push_subscriptions where endpoint = 'https://push.example.test/a1'`)));

// ---- Done ---------------------------------------------------------------
console.log("\nWhat the file reported on its first run:");
for (const row of report ?? []) console.log(`  ${row.what}: ${row.n}`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const f of failures) console.log(`  FAILED: ${f}`);
  process.exit(1);
}
