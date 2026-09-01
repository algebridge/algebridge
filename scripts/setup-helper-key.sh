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
#   Groq    https://console.groq.com/keys      (higher daily allowance)
#   Gemini  https://aistudio.google.com/apikey

set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://learn.algebridge.org"

say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m%s\033[0m\n" "$1"; exit 1; }

say "1/5  Paste your API key, then press Return."
printf "     (nothing will appear as you paste, that is deliberate)\n     key: "
read -rs KEY
echo
[ -n "${KEY:-}" ] || fail "No key entered. Nothing changed."

# The prefix identifies the provider, so you do not have to.
case "$KEY" in
  gsk_*)  VAR="GROQ_API_KEY";   WHO="Groq" ;;
  AIza*)  VAR="GEMINI_API_KEY"; WHO="Gemini" ;;
  sk-*)   VAR="OPENAI_API_KEY"; WHO="OpenAI" ;;
  *)      fail "That does not look like a Groq (gsk_...), Gemini (AIza...) or OpenAI (sk-...) key. Nothing changed." ;;
esac
say "     Recognised a $WHO key, setting $VAR."

say "2/5  Checking the Vercel link."
if ! npx --yes vercel whoami >/dev/null 2>&1; then
  printf "     Not logged in. A browser will open, sign in as algebridgeproject.\n"
  npx --yes vercel login
fi
if [ ! -f .vercel/project.json ]; then
  printf "     Project not linked yet, linking now.\n"
  npx --yes vercel link
fi

say "3/5  Storing $VAR on production."
# Replacing an existing value needs the old one gone first; a miss here is fine.
npx --yes vercel env rm "$VAR" production --yes >/dev/null 2>&1 || true
printf "%s" "$KEY" | npx --yes vercel env add "$VAR" production >/dev/null
unset KEY
printf "     Stored. The key is not written to this machine.\n"

say "4/5  Deploying."
npx --yes vercel --prod >/dev/null
printf "     Deployed.\n"

say "5/5  Asking the site whether a model is actually answering."
for i in 1 2 3 4 5 6; do
  BODY="$(curl -fsS "$SITE/api/helper/status" || true)"
  case "$BODY" in
    *'"answering":true'*)
      PROVIDER=$(printf "%s" "$BODY" | sed -n 's/.*"provider":"\([^"]*\)".*/\1/p')
      printf "\n\033[32m  Working. %s is answering.\033[0m\n" "$PROVIDER"
      printf "  The answer filter still applies to everything it returns.\n\n"
      printf "  Try it: open %s, click the star, and ask \"just tell me the answer\".\n\n" "$SITE"
      exit 0 ;;
  esac
  printf "     attempt %s, deployment still rolling out...\n" "$i"
  sleep 10
done

printf "\n\033[31m  A key is set but no model answered.\033[0m\n"
printf "  The reason per model is in the response below. 400 means a bad key,\n"
printf "  404 a retired model name, 429 a spent free quota.\n\n"
curl -fsS "$SITE/api/helper/status" || true
echo
exit 1
