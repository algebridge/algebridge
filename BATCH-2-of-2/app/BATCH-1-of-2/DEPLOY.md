# AlgeBridge — repo layout & deployment

This repo has **two parts**:

| Folder / file | What it is | Where it runs |
|---------------|------------|---------------|
| `index.html`, images, `CNAME` | Marketing site | **GitHub Pages** → [algebridge.org](https://algebridge.org) |
| `app/` | Full learning app (Next.js) | **Vercel** (recommended) |

## 1. Push code to GitHub

```bash
cd /Users/ivandubovyi/algebridge-github
git add .
git commit -m "Add AlgeBridge learning app alongside landing page"
git push origin main
```

## 2. Deploy the app on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import **algebridge/algebridge** from GitHub
3. Set **Root Directory** to `app` (important!)
4. Framework: **Next.js** (auto-detected)
5. Add environment variables (optional):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
6. Deploy

## 3. Custom domain for the app (optional)

In Vercel → Project → Settings → Domains, add e.g.:

- `learn.algebridge.org`

In your DNS (where algebridge.org is managed), add the CNAME record Vercel gives you.

Then update `index.html` — change `APP_URL` in the script at the bottom to your live URL.

## 4. GitHub Pages (landing page)

No change needed if Pages is already enabled on the `main` branch and `CNAME` points to `algebridge.org`.
