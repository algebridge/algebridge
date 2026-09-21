#!/usr/bin/env bash
# Give the local dev server the same AI the live site uses (Groq), so
# personalized problems and the study helper work on localhost.
#
#   bash scripts/local-ai-key.sh
#
# The key is read with a hidden prompt, so it never shows on screen or lands
# in shell history. It is checked with Groq before anything is written, and
# it goes into .env.local, which git ignores. The live site keeps its own
# copy in Vercel; this changes nothing there.
#
# Get a key at https://console.groq.com/keys (Create API Key).
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m%s\033[0m\n" "$1"; exit 1; }

say "Paste your Groq API key, then press Return."
printf "  (nothing will appear as you paste, that is deliberate)\n  key: "
read -rs RAW
echo

# Pastes pick up stray whitespace and terminal escapes; keep key characters only.
KEY="$(printf '%s' "${RAW:-}" | tr -d '[:space:]' | tr -cd 'A-Za-z0-9_.\-')"
unset RAW
[ -n "$KEY" ] || fail "Nothing was pasted. Nothing changed."
[ "${#KEY}" -ge 20 ] || fail "That is only ${#KEY} characters, too short for a key. Nothing changed."

say "Checking the key with Groq."
CODE="$(curl -s -o /dev/null -w '%{http_code}' https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $KEY" || echo 000)"
case "$CODE" in
  200) printf "  Groq accepted it.\n" ;;
  401|403) fail "Groq rejected that key (HTTP $CODE). Nothing changed." ;;
  *) printf "  Could not reach Groq (HTTP %s). Saving it anyway.\n" "$CODE" ;;
esac

# Replace any earlier GROQ_API_KEY line, keep everything else.
touch .env.local
TMP="$(mktemp)"
grep -v '^GROQ_API_KEY=' .env.local > "$TMP" || true
printf 'GROQ_API_KEY=%s\n' "$KEY" >> "$TMP"
cat "$TMP" > .env.local
rm -f "$TMP"
unset KEY

say "Saved to .env.local. Claude will restart the local server and check it."
