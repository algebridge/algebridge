-- ============================================================
-- AlgeBridge, 3 November 2026: hardening before press week.
--
-- NOT APPLIED. Ivan applies it, in the Supabase SQL editor; nobody runs it on
-- his behalf. It was tested end to end in PGlite (Postgres 17) on top of every
-- earlier schema file, run twice in a row to prove it is idempotent
-- (scripts/test-hardening-2026-11-03.mjs).
--
-- ONE FILE TO RUN, after every earlier schema file (the newest is
-- schema-2026-11-02-activity-backfill.sql). Every statement is idempotent.
-- Nothing here adds a constraint to a table that already has rows: the new
-- rules are triggers on new writes and functions, so applying it cannot fail
-- on data already stored.
--
-- What it does:
--   0. Names. One server-side rule for a real name (set_display_name's rule,
--      plus letters only and no web addresses) and one for the "First L."
--      other students see.
--   1. Alge Carts lobbies are private Realtime channels. Only signed-in
--      accounts join 'carts-lobbies' and 'carts-lobby-<n>', and not a student
--      whose teacher turned games off.
--   2. The Alge Carts board. A student's row carries their profile's name;
--      school accounts and students hidden from the leaderboard stay off it;
--      a bot row only takes the game's own bot names and what one match can
--      add; the board is read through carts_board(), without account ids.
--   3. The activity ticker. A title must be one the curriculum, the shop or
--      the games really have (anything else is told as the plain line), the
--      first name comes from a profile name that passes the real-name rule,
--      school accounts are refused, at most 6 moments a minute per account.
--      Rows already stored from school accounts, with an unknown title, or
--      from an account without a real name are deleted.
--   4. Display names. A direct write of profiles.display_name must pass the
--      real-name rule. leaderboard_stats.display_name is always the profile's
--      "First L.", and a rename reaches both boards at once.
--      leaderboard_public combines accounts only through
--      leaderboard_links; the accounts combined by name today are kept as
--      links, so nobody's row changes, and a rename no longer joins a
--      classmate's row.
--   5. Floods. record_visit counts at most 50,000 new visitors a day per
--      site, record_event at most 200 labels a day per site,
--      record_learning_event at most 300,000 facts a day. claim_role takes at
--      most 5 wrong access codes per account per hour.
--   6. forget_push_endpoint forgets only the caller's own devices.
--
-- The app, in this order:
--   * Apply THIS FILE FIRST, then ship src/lib/algecarts/net.ts (private
--     channels). A private channel with no policy refuses everyone, and the
--     game would fall back to solo for every player until this file runs.
--     Signed-out development guests (?guest=1) race solo from then on.
--   * src/lib/algecarts/leaderboard.ts should read carts_board(). Until it
--     does, its old table read shows only the bots and the reader's own row.
-- ============================================================


-- ============================================================
-- 0. Names
-- ============================================================

-- What is wrong with a name typed for a profile, or null when it is a real
-- "First Last". set_display_name's rule (no digits, usernames or email
-- addresses; 3 to 60 characters once tidied; a first name and a full last
-- name), and besides: letters, spaces, hyphens, apostrophes and periods only,
-- a period only at the end of a word (so no web addresses), no contact
-- details, and nothing longer than 200 characters before tidying.
create or replace function public.display_name_problem(p_raw text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  v text;
  parts text[];
begin
  if p_raw is null or btrim(p_raw) = '' then
    return 'Enter your first and last name.';
  end if;
  if char_length(p_raw) > 200 then
    return 'Enter your first and last name (3-60 characters).';
  end if;
  if p_raw ~ '[0-9_@/\\|<>]' or public.text_has_contact_info(p_raw) then
    return 'Names cannot contain numbers, usernames or email addresses.';
  end if;
  v := public.format_display_name(p_raw);
  if char_length(v) < 3 or char_length(v) > 60 then
    return 'Enter your first and last name (3-60 characters).';
  end if;
  if v !~ '^[[:alpha:]''’. -]+$' or v ~ '\.[^ ]' then
    return 'Use letters only in your name (hyphens and apostrophes are fine).';
  end if;
  parts := string_to_array(v, ' ');
  if coalesce(array_length(parts, 1), 0) < 2 then
    return 'Please enter both your first and last name.';
  end if;
  if char_length(regexp_replace(parts[array_length(parts, 1)], '[^[:alpha:]]', '', 'g')) < 2 then
    return 'Please enter your full last name, not just the initial.';
  end if;
  return null;
end;
$$;

-- The name other students see on a board: "First L." from the profile, the
-- way src/lib/leaderboard.ts publicLeaderboardName shows it. A single word
-- stays as it is; a first word that is not letters (an old email prefix with
-- digits, say) is "Anonymous Student".
create or replace function public.board_name(p_display_name text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  parts text[] := string_to_array(public.format_display_name(p_display_name), ' ');
  n integer := coalesce(array_length(parts, 1), 0);
  initial text;
begin
  if n = 0 or parts[1] !~ '^[[:alpha:]][[:alpha:]''’-]{0,23}$' then
    return 'Anonymous Student';
  end if;
  if n = 1 then
    return parts[1];
  end if;
  initial := upper(left(regexp_replace(parts[n], '[^[:alpha:]]', '', 'g'), 1));
  return case when initial = '' then parts[1] else parts[1] || ' ' || initial || '.' end;
end;
$$;


-- ============================================================
-- 1. Alge Carts lobbies: private channels for signed-in accounts
-- ============================================================

-- The lobby list ('carts-lobbies') and each lobby ('carts-lobby-<n>') were
-- public channels: a script holding the public key could join, read who was
-- racing (school accounts included) and send forged join, roster and snapshot
-- messages. The app now marks both private (src/lib/algecarts/net.ts), and a
-- private channel is reached only through these policies: a signed-in
-- account may join, read, send and track presence, unless a teacher of one
-- of its classes turned games off (class controls; the app hides the games
-- from that student too). School-managed students may race, because games are
-- their teacher's call (src/lib/school-mode.ts CLASS_ALWAYS_OFF). No name
-- rides on presence for anyone, and a school account races as "Racer".
create or replace function public.carts_lobby_allowed()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select auth.uid() is not null
     and not exists (
       select 1
         from public.class_members cm
         join public.class_controls cc on cc.class_id = cm.class_id
        where cm.student_id = auth.uid()
          and 'games' = any (cc.blocked_features)
     );
$$;
revoke all on function public.carts_lobby_allowed() from public, anon;
grant execute on function public.carts_lobby_allowed() to authenticated;

drop policy if exists "Alge Carts lobbies: signed-in read" on realtime.messages;
create policy "Alge Carts lobbies: signed-in read"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (realtime.topic() = 'carts-lobbies' or realtime.topic() ~ '^carts-lobby-[1-9][0-9]{0,5}$')
    and public.carts_lobby_allowed()
  );

drop policy if exists "Alge Carts lobbies: signed-in write" on realtime.messages;
create policy "Alge Carts lobbies: signed-in write"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (realtime.topic() = 'carts-lobbies' or realtime.topic() ~ '^carts-lobby-[1-9][0-9]{0,5}$')
    and public.carts_lobby_allowed()
  );


-- ============================================================
-- 2. The Alge Carts board
-- ============================================================

-- The game's own bot names (BOT_NAMES in src/lib/algecarts/engine/Game.ts),
-- and the numbered ones lobby 7 and up wears ("Mason R2.", namesForLobby).
create or replace function public.is_carts_bot_name(p_name text)
returns boolean
language sql immutable
as $$
  select p_name is not null
     and regexp_replace(p_name, '^([A-Z][a-z]+ [A-Z])([2-9]|[1-9][0-9])\.$', '\1.') = any (array[
    'Mason R.', 'Ava K.', 'Liam T.', 'Sophia M.', 'Noah P.', 'Emma L.', 'Ethan B.', 'Olivia S.',
    'Lucas D.', 'Mia C.', 'Aiden W.', 'Isabella G.', 'Jackson H.', 'Chloe N.', 'Logan F.', 'Zoe A.',
    'Caleb J.', 'Lily R.', 'Owen M.', 'Grace T.', 'Carter S.', 'Ella B.', 'Wyatt K.', 'Nora D.',
    'Julian P.', 'Hazel W.', 'Levi C.', 'Aria M.', 'Jayden L.', 'Leah S.', 'Gabriel R.', 'Riley H.',
    'Elijah T.', 'Layla B.', 'Hudson G.', 'Stella K.', 'Mateo A.', 'Violet J.', 'Ezra D.', 'Penelope F.',
    'Asher N.', 'Luna M.', 'Leo V.', 'Ivy C.', 'Miles P.', 'Ruby W.', 'Nolan S.', 'Sadie R.'
  ]);
$$;

-- Every write to the board, whoever sends it:
--   * a student's row takes its name from the profile ("First L."), and is
--     not stored for a school account or a student hidden from the leaderboard;
--   * a bot row is not stored unless the name is one of the game's bots, and
--     from the app it adds at most one match: 60 smashes, one win, one match.
-- A refused row is skipped without an error, so one odd bot does not sink the
-- rest of a host's batch. The SQL editor and the service role (no session)
-- are not limited.
create or replace function public.guard_carts_row()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  per_match constant integer := 60;
  fresh boolean;
begin
  if new.is_bot then
    if new.user_id is not null
       or not public.is_carts_bot_name(new.name)
       or new.key is distinct from 'b:' || new.name then
      return null;
    end if;
    if me is null then
      return new;
    end if;
    -- An upsert arrives as an INSERT first, even for a bot that has a row
    -- already, and the UPDATE that follows reads what this trigger left. So
    -- only a truly new row is held to one match here; an existing one is
    -- held to one match more than what is stored, in the UPDATE.
    fresh := tg_op = 'INSERT' and not exists (select 1 from public.carts_leaderboard c where c.key = new.key);
    if fresh then
      new.smashes := least(new.smashes, per_match);
      new.matches := least(new.matches, 1);
      new.wins := least(new.wins, 1);
      new.best_streak := least(new.best_streak, per_match);
      new.xp := least(new.xp, per_match * 15 + 40);
    elsif tg_op = 'UPDATE' then
      new.smashes := greatest(old.smashes, least(new.smashes, old.smashes + per_match));
      new.matches := greatest(old.matches, least(new.matches, old.matches + 1));
      new.wins := greatest(old.wins, least(new.wins, old.wins + 1));
      new.best_streak := greatest(old.best_streak, least(new.best_streak, per_match));
      new.xp := greatest(old.xp, least(new.xp, old.xp + per_match * 15 + 40));
    end if;
    new.wins := least(new.wins, new.matches);
    return new;
  end if;

  new.name := public.board_name((select p.display_name from public.profiles p where p.id = new.user_id));
  if me is not null and (
       public.profile_is_managed(new.user_id)
       or not exists (
         select 1 from public.leaderboard_stats s
          where s.user_id = new.user_id and s.leaderboard_opt_in
       )
     ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_carts_row on public.carts_leaderboard;
create trigger guard_carts_row
  before insert or update on public.carts_leaderboard
  for each row execute function public.guard_carts_row();

-- The table itself now shows each student only their own row, and the bots
-- (a host reads the bots' totals before adding a match to them). Everyone
-- else reads the board through carts_board(), which has no ids.
drop policy if exists "Signed-in students read the carts board" on public.carts_leaderboard;
drop policy if exists "Read your own carts row and the bots" on public.carts_leaderboard;
create policy "Read your own carts row and the bots"
  on public.carts_leaderboard for select to authenticated
  using (is_bot or user_id = auth.uid());

-- The board as students see it: rank, name, numbers, is_bot and is_me. No
-- user id and no key. School accounts and students hidden from the
-- leaderboard are left out whenever it is read, so hiding takes effect at once.
create or replace function public.carts_board(p_limit integer default 60)
returns table (
  rank        integer,
  name        text,
  is_bot      boolean,
  smashes     integer,
  wins        integer,
  matches     integer,
  best_streak integer,
  xp          integer,
  is_me       boolean
)
language sql security definer stable
set search_path = public
as $$
  select (row_number() over (order by c.smashes desc, c.wins desc, c.matches desc, c.name))::integer,
         c.name, c.is_bot, c.smashes, c.wins, c.matches, c.best_streak, c.xp,
         coalesce(c.user_id = auth.uid(), false)
    from public.carts_leaderboard c
   where auth.uid() is not null
     and (
       c.is_bot
       or (not public.profile_is_managed(c.user_id)
           and exists (
             select 1 from public.leaderboard_stats s
              where s.user_id = c.user_id and s.leaderboard_opt_in
           ))
     )
   order by c.smashes desc, c.wins desc, c.matches desc, c.name
   limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.carts_board(integer) from public, anon;
grant execute on function public.carts_board(integer) to authenticated;

-- Rows already stored: a bot row with a name the game never uses goes, and
-- every student's row takes its name from the profile.
delete from public.carts_leaderboard c
 where c.is_bot and not public.is_carts_bot_name(c.name);

update public.carts_leaderboard c
   set name = public.board_name(p.display_name)
  from public.profiles p
 where p.id = c.user_id
   and not c.is_bot
   and c.name is distinct from public.board_name(p.display_name);


-- ============================================================
-- 3. The activity ticker
-- ============================================================

-- Every title the ticker may show: the units ("Unit 2: Solving Equations &
-- Inequalities") and skills of both courses, everything the shop sells
-- (furniture, houses, ornaments, rink items) and the game cards, each the
-- way the app's cleanDetail() sends it. Made from the app's own data
-- (src/data/curriculum.ts, house-catalog.ts, ornament-catalog.ts,
-- rink-catalog.ts, src/lib/games.ts) on 3 Nov 2026. A title added to the app
-- later is told as the plain line ("finished a lesson") until a row is added
-- here.
create table if not exists public.ticker_titles (
  kind  text not null check (kind in ('skill', 'unit', 'bought', 'game')),
  title text not null check (char_length(title) between 1 and 48),
  primary key (kind, title)
);
alter table public.ticker_titles enable row level security;
-- No policies: only post_activity() reads it.
revoke all on table public.ticker_titles from anon, authenticated;

insert into public.ticker_titles (kind, title) values
  ('unit', 'Unit 10: Exponential Growth & Decay'),
  ('unit', 'Unit 10: Trigonometry'),
  ('unit', 'Unit 11: Quadratics: Multiplying & Factoring'),
  ('unit', 'Unit 12: Quadratic Functions & Equations'),
  ('unit', 'Unit 13: Absolute Value & Piecewise Functions'),
  ('unit', 'Unit 14: Data & Statistics'),
  ('unit', 'Unit 15: Modeling with Functions'),
  ('unit', 'Unit 1: Square Roots & Exponent Rules'),
  ('unit', 'Unit 1: Working with Units'),
  ('unit', 'Unit 2: Solving Equations & Inequalities'),
  ('unit', 'Unit 2: Square Roots, up to i'),
  ('unit', 'Unit 3: Complex Numbers'),
  ('unit', 'Unit 3: Linear Equations & Graphs'),
  ('unit', 'Unit 4: Forms of Linear Equations'),
  ('unit', 'Unit 4: Polynomial Functions'),
  ('unit', 'Unit 5: Quadratics Revisited'),
  ('unit', 'Unit 5: Systems of Equations'),
  ('unit', 'Unit 6: Inequalities (Systems & Graphs)'),
  ('unit', 'Unit 6: Rational Expressions & Equations'),
  ('unit', 'Unit 7: Functions'),
  ('unit', 'Unit 7: Radicals & Rational Exponents'),
  ('unit', 'Unit 8: Exponential & Logarithmic Functions'),
  ('unit', 'Unit 8: Sequences'),
  ('unit', 'Unit 9: Exponents & Radicals'),
  ('unit', 'Unit 9: Sequences & Series'),
  ('skill', 'Absolute Value Equations'),
  ('skill', 'Absolute Value Inequalities'),
  ('skill', 'Adding and Multiplying Roots'),
  ('skill', 'Arithmetic Sequences'),
  ('skill', 'Arithmetic Series'),
  ('skill', 'Center & Spread'),
  ('skill', 'Completing the Square'),
  ('skill', 'Complex Arithmetic'),
  ('skill', 'Complex Roots of Quadratics'),
  ('skill', 'Compound Inequalities'),
  ('skill', 'Cube Roots and nth Roots'),
  ('skill', 'Degree and End Behavior'),
  ('skill', 'Dimensional Analysis'),
  ('skill', 'Domain and Range'),
  ('skill', 'Elimination Method'),
  ('skill', 'Equations with Fractions'),
  ('skill', 'Exponent Rules'),
  ('skill', 'Exponential Decay'),
  ('skill', 'Exponential Functions'),
  ('skill', 'Exponential Growth'),
  ('skill', 'Factoring Special Cases'),
  ('skill', 'Factoring Trinomials'),
  ('skill', 'Function Notation'),
  ('skill', 'Geometric Sequences'),
  ('skill', 'Geometric Series'),
  ('skill', 'Graphing Inequalities'),
  ('skill', 'Graphing Linear Equations'),
  ('skill', 'Graphing Parabolas'),
  ('skill', 'Graphing Systems'),
  ('skill', 'Interpreting Function Graphs'),
  ('skill', 'Linear Inequalities'),
  ('skill', 'Linear vs. Exponential Models'),
  ('skill', 'Linear-Quadratic Systems'),
  ('skill', 'Literal Equations'),
  ('skill', 'Multi-Step Equations'),
  ('skill', 'Multiply & Divide Rational Expressions'),
  ('skill', 'Multiplying Binomials'),
  ('skill', 'Negative & Fractional Exponents'),
  ('skill', 'Negative Square Roots'),
  ('skill', 'One-Step Equations'),
  ('skill', 'Parallel & Perpendicular Lines'),
  ('skill', 'Piecewise Functions'),
  ('skill', 'Point-Slope Form'),
  ('skill', 'Properties of Logarithms'),
  ('skill', 'Radians and Degrees'),
  ('skill', 'Radical Equations'),
  ('skill', 'Rational Equations'),
  ('skill', 'Rational Exponents'),
  ('skill', 'Reference Angles'),
  ('skill', 'Remainder and Factor Theorems'),
  ('skill', 'Scientific Notation'),
  ('skill', 'Sigma Notation'),
  ('skill', 'Simplify Rational Expressions'),
  ('skill', 'Simplifying Radicals'),
  ('skill', 'Simplifying Square Roots'),
  ('skill', 'Slope'),
  ('skill', 'Slope-Intercept Form'),
  ('skill', 'Solving Exponential Equations'),
  ('skill', 'Solving by Factoring'),
  ('skill', 'Special Products'),
  ('skill', 'Square Roots'),
  ('skill', 'Standard Form'),
  ('skill', 'Substitution Method'),
  ('skill', 'Synthetic Division'),
  ('skill', 'Systems Word Problems'),
  ('skill', 'Systems of Inequalities'),
  ('skill', 'The Coordinate Plane'),
  ('skill', 'The Discriminant'),
  ('skill', 'The Imaginary Unit'),
  ('skill', 'The Quadratic Formula'),
  ('skill', 'Transforming Functions'),
  ('skill', 'Trend Lines & Correlation'),
  ('skill', 'Two-Step Equations'),
  ('skill', 'Two-Way Tables'),
  ('skill', 'Unit Circle Values'),
  ('skill', 'Unit Conversion Basics'),
  ('skill', 'Unit Word Problems'),
  ('skill', 'Vertex Form'),
  ('skill', 'What a Logarithm Is'),
  ('skill', 'X and Y Intercepts'),
  ('bought', 'Algebra Castle'),
  ('bought', 'Algebra Clock'),
  ('bought', 'Algebra Desk'),
  ('bought', 'Alpine Chalet'),
  ('bought', 'Arc Floor Lamp'),
  ('bought', 'Area Model Table'),
  ('bought', 'Art Easel'),
  ('bought', 'Autumn Wreath'),
  ('bought', 'Ball Pit'),
  ('bought', 'Battle Station'),
  ('bought', 'Beach Bungalow'),
  ('bought', 'Bird Bath'),
  ('bought', 'Block Castle'),
  ('bought', 'Bookshelf'),
  ('bought', 'Brass Balance'),
  ('bought', 'Bubbling Cauldron'),
  ('bought', 'Bunk Bed'),
  ('bought', 'Calculator Bot'),
  ('bought', 'Candy Bowl'),
  ('bought', 'Candy Machine'),
  ('bought', 'City Loft'),
  ('bought', 'Claw Machine'),
  ('bought', 'Cloud Bed'),
  ('bought', 'Cloud Couch'),
  ('bought', 'Coat Rack'),
  ('bought', 'Cone Course'),
  ('bought', 'Corner Cobweb'),
  ('bought', 'Cozy Beanbag'),
  ('bought', 'Cozy Cottage'),
  ('bought', 'Creator Ring Light'),
  ('bought', 'Crossing Lasers'),
  ('bought', 'Crystal Chandelier'),
  ('bought', 'DJ Booth'),
  ('bought', 'DJ Table'),
  ('bought', 'Desert Adobe'),
  ('bought', 'Desert Cactus'),
  ('bought', 'Desk Fan'),
  ('bought', 'Desk Lamp'),
  ('bought', 'Dino Skeleton'),
  ('bought', 'Disco Ball'),
  ('bought', 'Disco Ball Rig'),
  ('bought', 'Door Hoop'),
  ('bought', 'Dragon Egg'),
  ('bought', 'Dragon Statue'),
  ('bought', 'Drone Dock'),
  ('bought', 'Drum Kit'),
  ('bought', 'Dumbbell Rack'),
  ('bought', 'Electric Guitar'),
  ('bought', 'Espresso Machine'),
  ('bought', 'Fireplace'),
  ('bought', 'Floating Shelf'),
  ('bought', 'Floor Cushion'),
  ('bought', 'Flower Bed'),
  ('bought', 'Focus Yoga Mat'),
  ('bought', 'Foosball Table'),
  ('bought', 'Framed Line'),
  ('bought', 'Function Machine'),
  ('bought', 'Galaxy Aquarium'),
  ('bought', 'Gaming Chair'),
  ('bought', 'Garden Bench'),
  ('bought', 'Ghost Lamp'),
  ('bought', 'Glass Modern'),
  ('bought', 'Golden Calculator'),
  ('bought', 'Golden Ruler'),
  ('bought', 'Grand Piano'),
  ('bought', 'Growth Vine'),
  ('bought', 'Half-Plane Rug'),
  ('bought', 'Hanging Egg Chair'),
  ('bought', 'Hanging Planter'),
  ('bought', 'Hay Bale Seat'),
  ('bought', 'Headphone Stand'),
  ('bought', 'Histogram Bookcase'),
  ('bought', 'Hologram Table'),
  ('bought', 'Homework Station'),
  ('bought', 'Hot Tub'),
  ('bought', 'Ice Cream Cart'),
  ('bought', 'Indoor Slide'),
  ('bought', 'Infinity Pool'),
  ('bought', 'Intercept Neon'),
  ('bought', 'Jack-o''-Lantern'),
  ('bought', 'Jukebox'),
  ('bought', 'Lamp Post'),
  ('bought', 'Lava Lamp'),
  ('bought', 'Lesson TV'),
  ('bought', 'Light Arch'),
  ('bought', 'Lily Pond'),
  ('bought', 'Mailbox'),
  ('bought', 'Math Portal'),
  ('bought', 'Math Poster'),
  ('bought', 'Math Throne'),
  ('bought', 'Mini Arcade'),
  ('bought', 'Mini Fridge'),
  ('bought', 'Mini Greenhouse'),
  ('bought', 'Mini Ramp'),
  ('bought', 'Mini Science Lab'),
  ('bought', 'Model Rocket'),
  ('bought', 'Music Keyboard'),
  ('bought', 'Neon Math Sign'),
  ('bought', 'Neon Skater'),
  ('bought', 'Painted Lady'),
  ('bought', 'Palm Planter'),
  ('bought', 'Parabola Arch'),
  ('bought', 'Photo Booth'),
  ('bought', 'Picket Fence'),
  ('bought', 'Piecewise Neon'),
  ('bought', 'Pin Board'),
  ('bought', 'Pinball Machine'),
  ('bought', 'Planetarium Dome'),
  ('bought', 'Potted Plant'),
  ('bought', 'Potted Topiary'),
  ('bought', 'Projector Screen'),
  ('bought', 'Pumpkin Pile'),
  ('bought', 'Racing Sim Rig'),
  ('bought', 'Radical Bonsai'),
  ('bought', 'Reading Hammock'),
  ('bought', 'Record Player'),
  ('bought', 'Record Wall'),
  ('bought', 'Red Barn'),
  ('bought', 'Rinkside Bench'),
  ('bought', 'Robot Dog'),
  ('bought', 'Rocket Ship'),
  ('bought', 'Scoreboard'),
  ('bought', 'Shade Tree'),
  ('bought', 'Side Table'),
  ('bought', 'Skate Banner'),
  ('bought', 'Skateboard'),
  ('bought', 'Snack Bar'),
  ('bought', 'Snack Stand'),
  ('bought', 'Speaker Tower'),
  ('bought', 'Spinning Globe'),
  ('bought', 'Staircase Shelf'),
  ('bought', 'Star Telescope'),
  ('bought', 'Stone Fountain'),
  ('bought', 'String Lights'),
  ('bought', 'Study Chair'),
  ('bought', 'Study Scarecrow'),
  ('bought', 'Study Whiteboard'),
  ('bought', 'Terrarium'),
  ('bought', 'Time Machine'),
  ('bought', 'Treehouse Hideout'),
  ('bought', 'Trophy Case'),
  ('bought', 'Tutor Bot'),
  ('bought', 'Unicorn Statue'),
  ('bought', 'Vending Machine'),
  ('bought', 'Wall Bike'),
  ('bought', 'Welcome Rug'),
  ('bought', 'Witch''s Broom'),
  ('game', 'Bat with Liam'),
  ('game', 'Cheer with Kenise'),
  ('game', 'Score with Rayla'),
  ('game', 'Skate with Veronica'),
  ('game', 'Spike with Jordyn'),
  ('game', 'Wrestle with Shaurya')
on conflict (kind, title) do nothing;

create or replace function public.post_activity(
  p_kind   text,
  p_amount integer default null,
  p_detail text default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  full_name text;
  nm        text;
  last_at   timestamptz;
  lately    integer;
begin
  if uid is null then
    return;
  end if;
  if p_kind is null or p_kind not in ('solved', 'bridgeys', 'skill', 'unit', 'bought', 'game') then
    return;
  end if;

  -- What each kind carries. A title has to be one the app really has
  -- (public.ticker_titles); any other words are dropped and the moment is
  -- told as the plain line, so nothing a student typed reaches the strip.
  if p_kind = 'bridgeys' then
    if p_amount is null or p_amount < 1 or p_amount > 100000 then return; end if;
    p_detail := null;
  elsif p_kind = 'solved' then
    p_amount := null;
    p_detail := null;
  else
    p_amount := null;
    if p_detail is null
       or public.text_has_contact_info(p_detail)
       or not exists (select 1 from public.ticker_titles t where t.kind = p_kind and t.title = p_detail) then
      p_detail := null;
    end if;
  end if;

  -- School accounts never appear (the app drops them too; this is the floor).
  if public.profile_is_managed(uid) then
    return;
  end if;

  -- The first name comes from the profile, and only from a name that passes
  -- the real-name rule, so an old email prefix or a name written straight
  -- into the table never reaches every student's screen. Students only.
  select p.display_name into full_name
    from public.profiles p
   where p.id = uid and p.role = 'student';
  if full_name is null or public.display_name_problem(full_name) is not null then
    return;
  end if;
  nm := split_part(full_name, ' ', 1);
  if length(nm) > 30 or nm !~ '^[[:alpha:]][[:alpha:]''’.-]*$' then
    return;
  end if;

  -- Only students who are on the leaderboard: hiding from the board hides from the ticker too.
  if not exists (
    select 1 from public.leaderboard_stats s where s.user_id = uid and s.leaderboard_opt_in
  ) then
    return;
  end if;

  -- At most one row every two seconds, and six a minute, per account; a
  -- script writing faster is dropped.
  select max(f.at), count(*) into last_at, lately
    from public.activity_feed f
   where f.user_id = uid and f.at > now() - interval '1 minute';
  if (last_at is not null and last_at > now() - interval '2 seconds') or lately >= 6 then
    return;
  end if;

  insert into public.activity_feed (user_id, first_name, kind, amount, detail)
  values (uid, nm, p_kind, p_amount, p_detail);

  -- Housekeeping, now and then: rows older than seven days are forgotten.
  if random() < 0.02 then
    delete from public.activity_feed f where f.at < now() - interval '7 days';
  end if;
end;
$$;

revoke all on function public.post_activity(text, integer, text) from public, anon;
grant execute on function public.post_activity(text, integer, text) to authenticated;

-- The latest moments, as before, without a school account's or a student who
-- has since hidden from the leaderboard: both checked when the strip reads,
-- so they leave the strip at once.
create or replace function public.recent_activity(
  p_after bigint default 0,
  p_limit integer default 40
)
returns table (
  id         bigint,
  at         timestamptz,
  first_name text,
  kind       text,
  amount     integer,
  detail     text
)
language sql security definer stable
set search_path = public
as $$
  select f.id, f.at, f.first_name, f.kind, f.amount, f.detail
    from public.activity_feed f
   where auth.uid() is not null
     and f.id > coalesce(p_after, 0)
     and f.at > now() - interval '7 days'
     and not public.profile_is_managed(f.user_id)
     and exists (
       select 1 from public.leaderboard_stats s
        where s.user_id = f.user_id and s.leaderboard_opt_in
     )
   order by f.id desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.recent_activity(bigint, integer) from public, anon;
grant execute on function public.recent_activity(bigint, integer) to authenticated;

-- Rows already on the feed: school accounts' (the backfill never left them
-- out), any title the app does not have, and any account whose profile name
-- does not pass the real-name rule.
delete from public.activity_feed f
 where public.profile_is_managed(f.user_id);

delete from public.activity_feed f
 where f.detail is not null
   and not exists (select 1 from public.ticker_titles t where t.kind = f.kind and t.title = f.detail);

delete from public.activity_feed f
 where public.display_name_problem((select p.display_name from public.profiles p where p.id = f.user_id)) is not null;


-- ============================================================
-- 4. Display names
-- ============================================================

-- The "Users can update own profile" policy covers every column, and
-- tidy_display_name only formats, so a direct write stored web addresses and
-- 5,000-character names. Now a changed name must pass display_name_problem().
-- Checked for the app's own writes (the profile page writes the row
-- directly) and for a signed-in caller's function changing a name
-- (set_display_name). Not for a signup (handle_new_user), the service role
-- (teacher-made accounts) or the SQL editor. A name that does not change is
-- always fine: saving a bio sends the stored name back, and an older account
-- keeps the name it has until it changes it.
create or replace function public.guard_profile_display_name()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  was     text;
  problem text;
begin
  if not (current_user in ('authenticated', 'anon')
          or (tg_op = 'UPDATE'
              and auth.uid() is not null
              and current_user not in ('service_role', 'supabase_auth_admin'))) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    was := old.display_name;
  else
    -- The profile page saves with an upsert, which arrives as an INSERT
    -- first: compare with the row it is about to update, when there is one.
    select p.display_name into was from public.profiles p where p.id = new.id;
  end if;
  if nullif(public.format_display_name(new.display_name), '') is not distinct from was then
    return new;
  end if;
  problem := public.display_name_problem(new.display_name);
  if problem is not null then
    raise exception '%', problem using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Named to run before tidy_display_name (triggers fire in name order), so it
-- reads what was typed.
drop trigger if exists guard_profile_display_name on public.profiles;
create trigger guard_profile_display_name
  before insert or update of display_name on public.profiles
  for each row execute function public.guard_profile_display_name();

-- The leaderboard's name is the profile's "First L.", whoever writes the
-- row. The app wrote it from the browser, so any words could go on the board.
create or replace function public.leaderboard_name_from_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.display_name := public.board_name((select p.display_name from public.profiles p where p.id = new.user_id));
  return new;
end;
$$;

drop trigger if exists leaderboard_name_from_profile on public.leaderboard_stats;
create trigger leaderboard_name_from_profile
  before insert or update on public.leaderboard_stats
  for each row execute function public.leaderboard_name_from_profile();

-- A new profile name reaches both boards at once, however it was saved (the
-- profile page writes the row directly and never touched the boards).
create or replace function public.board_names_follow_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.leaderboard_stats set display_name = public.board_name(new.display_name) where user_id = new.id;
    update public.carts_leaderboard set name = public.board_name(new.display_name) where user_id = new.id and not is_bot;
  end if;
  return null;
end;
$$;

drop trigger if exists board_names_follow_profile on public.profiles;
create trigger board_names_follow_profile
  after update of display_name on public.profiles
  for each row execute function public.board_names_follow_profile();

-- Every row's name, once, from its profile.
update public.leaderboard_stats ls
   set display_name = public.board_name((select p.display_name from public.profiles p where p.id = ls.user_id))
 where ls.display_name is distinct from
       public.board_name((select p.display_name from public.profiles p where p.id = ls.user_id));

-- One student, one row (schema-2026-10-14-leaderboard-merge.sql) combined
-- accounts whose profiles carried the same name, so renaming yourself to a
-- classmate's full name put your account inside their row: your Bridgeys on
-- their line, and your house, title and character shown on it. From now on
-- accounts are combined only by public.leaderboard_links, which an admin
-- writes. So that no row on the board changes today, the accounts combined by
-- name right now are written down as links first, once.
--
-- The trade-off: a student who makes a second account later is not combined
-- with the first on their own; an admin adds a leaderboard_links row. And two
-- different students who share a full name today stay combined until an admin
-- deletes those two links (note 'Combined by name until 2026-11-03').
do $$
begin
  if not exists (select 1 from public.safety_migration_steps where step = '2026-11-03 board links from names') then
    with accts as (
      select ls.user_id,
             lk.person_key as linked,
             nullif(lower(regexp_replace(trim(p.display_name), '\s+', ' ', 'g')), '') as by_name
        from public.leaderboard_stats ls
        left join public.leaderboard_links lk on lk.user_id = ls.user_id
        left join public.profiles p on p.id = ls.user_id
       where ls.leaderboard_opt_in
         and not public.profile_is_managed(ls.user_id)
    ),
    keyed as (
      select a.user_id, a.linked, a.by_name, coalesce(a.linked, a.by_name, a.user_id::text) as person
        from accts a
    ),
    shared as (
      select k.person from keyed k group by k.person having count(*) > 1
    )
    insert into public.leaderboard_links (user_id, person_key, note)
    select k.user_id, k.by_name, 'Combined by name until 2026-11-03'
      from keyed k
      join shared s on s.person = k.person
     where k.linked is null
       and k.by_name is not null
       and char_length(k.by_name) between 1 and 120
    on conflict (user_id) do nothing;

    insert into public.safety_migration_steps (step) values ('2026-11-03 board links from names');
  end if;
end;
$$;

-- The board, combined by link or not at all. Same columns as before.
create or replace view public.leaderboard_public with (security_barrier = true) as
with accts as (
  select ls.*,
         coalesce(lk.person_key, ls.user_id::text) as person
    from public.leaderboard_stats ls
    left join public.leaderboard_links lk on lk.user_id = ls.user_id
   where ls.leaderboard_opt_in
     and auth.uid() is not null
     and not public.profile_is_managed(ls.user_id)
),
latest as (
  select distinct on (person) person, display_name, equipped_title, house_style, avatar, city_plots
    from accts
   order by person, updated_at desc
),
best as (
  select distinct on (person) person, best_furniture_value, best_furniture_name
    from accts
   order by person, best_furniture_value desc, updated_at desc
),
skills as (
  select a.person, count(distinct s.key)::int as done
    from accts a
    join public.user_progress up on up.user_id = a.user_id
    cross join lateral jsonb_each(case when jsonb_typeof(up.progress_json -> 'skills') = 'object' then up.progress_json -> 'skills' else '{}'::jsonb end) s
   where s.value ->> 'level' in ('proficient', 'mastered')
   group by a.person
),
totals as (
  select person,
         sum(bridgeys)::int as bridgeys,
         max(completed_skills)::int as most_skills,
         max(updated_at) as updated_at,
         bool_or(user_id = auth.uid()) as is_me
    from accts
   group by person
)
select l.display_name,
       t.bridgeys,
       greatest(coalesce(sk.done, 0), t.most_skills) as completed_skills,
       b.best_furniture_value,
       b.best_furniture_name,
       l.equipped_title,
       true as leaderboard_opt_in,
       t.updated_at,
       t.is_me,
       l.house_style,
       l.avatar,
       l.city_plots
  from totals t
  join latest l using (person)
  join best b using (person)
  left join skills sk using (person);

revoke all on public.leaderboard_public from public, anon, authenticated;
grant select on public.leaderboard_public to authenticated;


-- ============================================================
-- 5. Floods
-- ============================================================

-- A daily allowance shared by everyone calling one function. Visitor ids are
-- made by the browser, so a script makes a new one for every call and the
-- per-visitor caps alone never stop it. One row per (bucket, day); taking one
-- is a single upsert, refused once the day's allowance is used.
create table if not exists public.write_budget (
  bucket text    not null,
  day    date    not null,
  n      integer not null default 0,
  primary key (bucket, day)
);
alter table public.write_budget enable row level security;
-- No policies: only the functions below use it.
revoke all on table public.write_budget from anon, authenticated;

create or replace function public.take_write_budget(p_bucket text, p_day date, p_cap integer)
returns boolean
language plpgsql security definer volatile
set search_path = public
as $$
declare
  got integer;
begin
  insert into public.write_budget as w (bucket, day, n)
  values (p_bucket, p_day, 1)
  on conflict (bucket, day) do update set n = w.n + 1
    where w.n < p_cap
  returning w.n into got;
  if random() < 0.001 then
    delete from public.write_budget w where w.day < p_day - 30;
  end if;
  return got is not null;
end;
$$;
revoke all on function public.take_write_budget(text, date, integer) from public, anon, authenticated;

-- record_visit, as in schema-2026-10-05-console.sql, with a ceiling on new
-- visitors: 50,000 a day per site. A visitor already counted today keeps
-- counting (up to 300 views, as before).
create or replace function public.record_visit(
  p_site     text,
  p_visitor  uuid,
  p_path     text default '/',
  p_referrer text default null,
  p_device   text default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d     date := public.traffic_today();
  page  text := public.traffic_clean_path(p_path);
  ref   text := case when p_referrer ~ '^[a-z0-9.-]{1,100}$' then p_referrer end;
  dev   text := case when p_device in ('phone', 'tablet', 'computer') then p_device end;
  seen  integer;
begin
  if p_site is null or p_site not in ('site', 'app') or p_visitor is null then
    return;
  end if;

  if not exists (
       select 1 from public.traffic_visitors t
        where t.day = d and t.site = p_site and t.visitor = p_visitor
     )
     and not public.take_write_budget('visitors:' || p_site, d, 50000) then
    return;
  end if;

  insert into public.traffic_visitors as t (day, site, visitor, views, entry_path, referrer, device)
  values (d, p_site, p_visitor, 1, page, ref, dev)
  on conflict (day, site, visitor) do update
    set views = t.views + 1
    where t.views < 300
  returning t.views into seen;

  if seen is null then
    return;  -- this visitor is past today's cap
  end if;

  -- A day keeps at most 500 different pages per site; the rest count as (other).
  if not exists (select 1 from public.traffic_pages where day = d and site = p_site and path = page)
     and (select count(*) from public.traffic_pages where day = d and site = p_site) >= 500 then
    page := '(other)';
  end if;

  insert into public.traffic_pages as tp (day, site, path, views)
  values (d, p_site, page, 1)
  on conflict (day, site, path) do update set views = tp.views + 1;

  -- Keep about 13 months.
  if random() < 0.01 then
    delete from public.traffic_visitors where day < d - 400;
    delete from public.traffic_pages    where day < d - 400;
    delete from public.traffic_events   where day < d - 400;
  end if;
end;
$$;

-- record_event, as before, with a ceiling on different labels: 200 a day per
-- site, the rest counted as (other). Each label was a new row before.
create or replace function public.record_event(
  p_site    text,
  p_visitor uuid,
  p_name    text,
  p_label   text
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d        date := public.traffic_today();
  n_clicks integer;
  lbl      text := p_label;
begin
  if p_site is null or p_site not in ('site', 'app') or p_visitor is null
     or p_name is null or p_name not in ('cta_click')
     or p_label is null or p_label !~ '^[a-z0-9-]{1,40}$' then
    return;
  end if;

  -- Only a visitor who opened a page today can click, at most 100 times.
  update public.traffic_visitors as t
  set clicks = t.clicks + 1
  where t.day = d and t.site = p_site and t.visitor = p_visitor and t.clicks < 100
  returning t.clicks into n_clicks;

  if n_clicks is null then
    return;
  end if;

  if not exists (select 1 from public.traffic_events e where e.day = d and e.site = p_site and e.name = p_name and e.label = lbl)
     and (select count(*) from public.traffic_events e where e.day = d and e.site = p_site) >= 200 then
    lbl := '(other)';
  end if;

  insert into public.traffic_events as e (day, site, name, label, n)
  values (d, p_site, p_name, lbl, 1)
  on conflict (day, site, name, label) do update set n = e.n + 1;
end;
$$;

revoke all on function public.record_visit(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_event(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_visit(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.record_event(text, uuid, text, text) to anon, authenticated;

-- record_learning_event, as in schema-2026-10-27-insights.sql, with a ceiling
-- for the whole platform: 300,000 facts a day.
create or replace function public.record_learning_event(
  p_visitor uuid,
  p_role    text,
  p_name    text,
  p_course  text default null,
  p_unit    text default null,
  p_skill   text default null,
  p_label   text default null,
  p_value   numeric default null,
  p_ok      boolean default null,
  p_first   boolean default null,
  p_n       integer default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d     date := public.traffic_today();
  slug  constant text := '^[a-z0-9_-]{1,60}$';
  today_rows integer;
begin
  if p_visitor is null
     or p_name is null or p_name not in (
       'problem_attempt', 'problem_skip', 'skill_time', 'archie_open', 'archie_message',
       'game_start', 'game_end', 'mood', 'mood_dismiss')
     or (p_course is not null and p_course !~ slug)
     or (p_unit   is not null and p_unit   !~ slug)
     or (p_skill  is not null and p_skill  !~ slug)
     or (p_label  is not null and p_label  !~ slug)
     or (p_value  is not null and (p_value < 0 or p_value > 100000))
     or (p_n      is not null and (p_n < 0 or p_n > 100000)) then
    return;
  end if;

  -- One browser writes at most 3000 facts a day; a script writing more is dropped.
  select count(*) into today_rows from public.learning_events where day = d and visitor = p_visitor;
  if today_rows >= 3000 then
    return;
  end if;

  if not public.take_write_budget('learning_events', d, 300000) then
    return;
  end if;

  insert into public.learning_events (day, visitor, role, name, course, unit, skill, label, value, ok, first, n)
  values (
    d, p_visitor,
    case when p_role in ('student', 'teacher', 'tutor') then p_role else 'guest' end,
    p_name, p_course, p_unit, p_skill, p_label, p_value, p_ok, p_first, p_n
  );

  -- Keep about 13 months.
  if random() < 0.002 then
    delete from public.learning_events where day < d - 400;
  end if;
end;
$$;

revoke all on function public.record_learning_event(uuid, text, text, text, text, text, text, numeric, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_learning_event(uuid, text, text, text, text, text, text, numeric, boolean, boolean, integer) to anon, authenticated;

-- claim_role: at most 5 wrong access codes per account per hour.
--
-- A wrong code has to be remembered, and an error raised inside the function
-- would roll the memory back with it. So a wrong code is stored and answered
-- WITHOUT raising: the function sets PostgREST's response.status to 400 and
-- returns the same {code, message, details, hint} body an error has, which
-- supabase-js reads as `error` (src/lib/social.ts claimRole shows
-- error.message, as before). PostgREST commits a request whose function
-- returns normally, whatever status it sets. The sixth wrong code within the
-- hour, and anything after it, raises "Too many wrong access codes".
-- The return type changes from text to json (a right code returns the role,
-- as a JSON string), so the function is dropped and made again.
create table if not exists public.role_code_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists role_code_attempts_user_at_idx on public.role_code_attempts (user_id, at desc);
alter table public.role_code_attempts enable row level security;
-- No policies: only claim_role() reads and writes it.
revoke all on table public.role_code_attempts from anon, authenticated;

drop function if exists public.claim_role(text, text);
create function public.claim_role(target_role text, code text default null)
returns json
language plpgsql security definer
set search_path = public, auth
as $$
declare
  me    uuid := auth.uid();
  wrong integer;
begin
  if me is null then raise exception 'You must be signed in'; end if;
  if target_role not in ('student', 'teacher', 'tutor') then raise exception 'Unknown role'; end if;
  if target_role in ('teacher', 'tutor') and not public.is_admin() then
    select count(*) into wrong
      from public.role_code_attempts a
     where a.user_id = me and a.at > now() - interval '1 hour';
    if wrong >= 5 then
      raise exception 'Too many wrong access codes. Try again in an hour.' using errcode = '54000';
    end if;
    -- Qualified as claim_role.code: a bare `code` collides with role_codes.code.
    if not exists (select 1 from public.role_codes rc where rc.role = target_role and rc.code = coalesce(claim_role.code, '')) then
      insert into public.role_code_attempts (user_id) values (me);
      if random() < 0.05 then
        delete from public.role_code_attempts a where a.at < now() - interval '1 day';
      end if;
      perform set_config('response.status', '400', true);
      return json_build_object(
        'code', 'P0001',
        'message', format('That access code is not valid for the %s role.', target_role),
        'details', null,
        'hint', null);
    end if;
  end if;
  update public.profiles set role = target_role where id = me;
  if target_role = 'tutor' then perform public.join_all_tutors_group(); end if;
  return to_json(target_role);
end;
$$;
revoke all on function public.claim_role(text, text) from public, anon;
grant execute on function public.claim_role(text, text) to authenticated;


-- ============================================================
-- 6. Push devices: forget only your own
-- ============================================================

-- forget_push_endpoint deleted any device row whose endpoint the caller
-- named, and push_targets_for_message/ring hand a peer's endpoints to anyone
-- allowed to reach that peer. Now it deletes only the caller's own devices.
-- The push Edge Function (supabase/functions/push) runs as the sender, so
-- its cleanup of a recipient's dead device (404/410) no longer deletes that
-- row; the row is replaced when the device saves itself again, or dropped by
-- the 10-device limit in save_push_subscription.
create or replace function public.forget_push_endpoint(p_endpoint text)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint
     and user_id = auth.uid();
$$;
revoke all on function public.forget_push_endpoint(text) from public;
grant execute on function public.forget_push_endpoint(text) to authenticated;


-- Tell the API about the new and changed functions right away.
notify pgrst, 'reload schema';


-- ============================================================
-- What happened
-- ============================================================
select 'ticker rows left' as what, count(*)::text as n from public.activity_feed
union all
select 'ticker titles known', count(*)::text from public.ticker_titles
union all
select 'carts rows a student can see', count(*)::text
  from public.carts_leaderboard c
 where c.is_bot
    or (not public.profile_is_managed(c.user_id)
        and exists (select 1 from public.leaderboard_stats s where s.user_id = c.user_id and s.leaderboard_opt_in))
union all
select 'board links kept from the name merge', count(*)::text
  from public.leaderboard_links where note = 'Combined by name until 2026-11-03'
union all
select 'rows on the leaderboard', count(*)::text from public.leaderboard_stats where leaderboard_opt_in;
