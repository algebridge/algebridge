# AlgeBridge

**Bridge the gap from arithmetic to algebra.**

AlgeBridge is a free Algebra 1 learning platform for grades 7–10. It combines curated YouTube videos, research-backed teaching methods, and interactive practice with mastery tracking.

## Phase 2 Features 

- **Verified YouTube videos** — all 46 skills use validated video IDs
- **Bridge Review** — spaced repetition at 1/3/7/14/30 day intervals (`/review`)
- **AI Tutor** — personalized hints via `/api/tutor` (OpenAI optional, smart fallback built-in)
- **Cloud login** — Supabase auth + progress sync (optional, configure via `.env`)
- **Anonymous progress** — still works via localStorage with export/import

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Cloud login & sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Cloud login & sync |
| `OPENAI_API_KEY` | No | AI-powered tutor hints |

Run `supabase/schema.sql` in your Supabase project SQL editor to create the progress table.

## Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| **1** | ✅ Done | Curriculum, videos, practice, local progress |
| **2** | ✅ Current | Verified videos, AI tutor, Bridge Review, Supabase auth |
| **3** | Planned | Desmos graphs, teacher dashboard, mobile PWA |

## License

Free for educational use.
