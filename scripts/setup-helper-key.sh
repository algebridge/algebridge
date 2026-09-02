#!/usr/bin/env bash
# Wire an AI key into the study helper, deploy, and prove it took.
#
# Run it, paste the key when asked, and walk away. The key is read with a
# hidden prompt so it never reaches your shell history, never appears in this
# script, and never gets echoed to the terminal.
#
#   bash scripts/setup-helper-key.sh
#
# Get a key first:
#   Gemini  https://aistudio.google.com/apikey
#   Groq    https://console.groq.com/keys      (higher daily allowance)

set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://learn.algebridge.org"

say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m%s\033[0m\n" "$1"; exit 1; }

say "1/5  Paste your API key, then press Return."
printf "     (nothing will appear as you paste, that is deliberate)\n     key: "
read -rs RAW
echo

# Pastes pick up stray whitespace, newlines, and occasionally the terminal's
# bracketed-paste escapes. Strip anything that is not a key character before
# looking at it, or a good key gets rejected for an invisible reason.
KEY="$(printf '%s' "${RAW:-}" | tr -d '[:space:]' | tr -cd 'A-Za-z0-9_.\-')"
unset RAW
[ -n "$KEY" ] || fail "Nothing was pasted. Nothing changed."

if [ "${#KEY}" -lt 20 ]; then
  fail "That is only ${#KEY} characters, too short for an API key. If you copied the masked value shown in the table (something like ...cpKg), open the key and copy the full one. Nothing changed."
fi

# Ask each provider whether the key is theirs, rather than guessing from a
# prefix. Prefixes change and a wrong guess is indistinguishable from a bad
# key. This also means an invalid key is caught here, before any deploy.
say "2/5  Checking which provider accepts this key."

probe_gemini() {
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$1" \
    -H 'Content-Type: application/json' \
    -d '{"contents":[{"role":"user","parts":[{"text":"hi"}]}],"generationConfig":{"maxOutputTokens":100}}'
}
probe_groq() {
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    "https://api.groq.com/openai/v1/chat/completions" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}],"max_tokens":50}'
}
probe_openai() {
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    "https://api.openai.com/v1/chat/completions" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":50}'
}

VAR=""; WHO=""
for candidate in gemini groq openai; do
  case "$candidate" in
    gemini) CODE="$(probe_gemini "$KEY")"; V=GEMINI_API_KEY; N=Gemini ;;
    groq)   CODE="$(probe_groq   "$KEY")"; V=GROQ_API_KEY;   N=Groq ;;
    openai) CODE="$(probe_openai "$KEY")"; V=OPENAI_API_KEY; N=OpenAI ;;
  esac
  printf "     %-7s -> HTTP %s\n" "$N" "$CODE"
  if [ "$CODE" = "200" ]; then VAR="$V"; WHO="$N"; break; fi
done

if [ -z "$VAR" ]; then
  printf "\n\033[31m  No provider accepted that key.\033[0m\n"
  printf "  It is %s characters and starts with %s...\n" "${#KEY}" "$(printf '%s' "$KEY" | cut -c1-4)"
  printf "  A 400 or 401 above means the key is wrong or incomplete. A 429 means\n"
  printf "  the key is valid but the free quota is spent, in which case rerun later.\n"
  printf "  Nothing was changed.\n\n"
  exit 1
fi
printf "     Accepted by %s, setting %s.\n" "$WHO" "$VAR"

say "3/5  Checking the Vercel link."
if ! npx --yes vercel whoami >/dev/null 2>&1; then
  printf "     Not logged in. A browser will open, sign in as algebridgeproject.\n"
  npx --yes vercel login
fi
if [ ! -f .vercel/project.json ]; then
  printf "     Project not linked yet, linking now.\n"
  npx --yes vercel link
fi

say "4/5  Storing $VAR on production and deploying."
npx --yes vercel env rm "$VAR" production --yes >/dev/null 2>&1 || true
printf "%s" "$KEY" | npx --yes vercel env add "$VAR" production >/dev/null
unset KEY
npx --yes vercel --prod >/dev/null
printf "     Deployed. The key is not written to this machine.\n"

say "5/5  Asking the site whether a model is actually answering."
for i in 1 2 3 4 5 6; do
  BODY="$(curl -fsS "$SITE/api/helper/status" || true)"
  case "$BODY" in
    *'"answering":true'*)
      PROVIDER=$(printf '%s' "$BODY" | sed -n 's/.*"provider":"\([^"]*\)".*/\1/p')
      printf "\n\033[32m  Working. %s is answering.\033[0m\n" "$PROVIDER"
      printf "  The answer filter still applies to everything it returns.\n\n"
      printf "  Try it: open %s, click the star, and say \"hi\" twice.\n\n" "$SITE"
      exit 0 ;;
  esac
  printf "     attempt %s, deployment still rolling out...\n" "$i"
  sleep 10
done

printf "\n\033[31m  The key works but the site is not using it yet.\033[0m\n"
curl -fsS "$SITE/api/helper/status" || true
echo
exit 1
