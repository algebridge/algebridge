# AlgeBridge

A free, ad-free Algebra 1 course for students, built by students. The marketing site is [algebridge.org](https://algebridge.org) and the platform is [learn.algebridge.org](https://learn.algebridge.org).

## What students get

- **Algebra 1**: 15 units and 52 skills, from working with units to modeling with functions. Each skill has a key idea, a video and practice with instant feedback, and the course tracks mastery skill by skill.
- **Algebra 2**: a second course that builds on the first.
- **Review**: finished skills come back for spaced review.
- **Archie**: an AI study helper that gives hints. It tells students it is an AI.
- **Games and a house**: practice earns Bridgeys, which students spend on a 3D house, and games such as Alge Carts ask practice questions as you play.

## What teachers get

Classes, assignments with due dates, teacher-made student accounts, per-student progress, and class controls for games and the leaderboard.

## Safety and privacy

- Student data lives in Supabase (Postgres) behind row-level security. A signed-out visitor reads nothing, and students cannot read each other's progress, email or messages.
- Typed text is checked for personal information (phone numbers, emails, addresses, handles) and for crisis language, which brings up 988 and Crisis Text Line.
- Messages, groups and calls have report and block.
- No ads, and student data is never sold.

The policies are at [learn.algebridge.org/privacy](https://learn.algebridge.org/privacy) and [learn.algebridge.org/terms](https://learn.algebridge.org/terms). Security reports go to info@algebridge.org.

## Code

- `index.html`: the marketing site, served by GitHub Pages.
- `src/`: the platform, Next.js 15, React 19, TypeScript and Tailwind, deployed on Vercel.
- `supabase/`: the database schema and row-level security policies, one file per change, applied in date order.
- `extension/`: the AlgeBridge Hints browser extension.

```bash
npm install
npm run dev
```

Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` the platform runs local-only and keeps progress in the browser. Tests: `npm run test:practice`, `npm run test:problems` (solves every generated problem), `npm run test:helper`, `npm run test:classroom`.

## License

Free for educational use.
