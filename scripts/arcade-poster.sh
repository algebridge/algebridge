#!/bin/sh
# poster.sh <slug> "<logo query>"
S="${TMPDIR:-/tmp}"; cd "$(dirname "$0")/.."
node scripts/arcade-smoke.mjs $1 --size 1820x1024 --eval "window.__arcade.debug.poster();1" --wait 500 --eval "document.querySelectorAll('.ak-hud,.ak-overlay,.ak-toasts,.ak-touch').forEach(e=>e.style.display='none');1" --shot $S/$1-poster.png 2>&1 | grep -E "ERR|EXC|SMOKE"
sips -c 1024 1024 $S/$1-poster.png --out $S/$1-poster-sq.png >/dev/null 2>&1
public/arcade/_logo/mk.sh $1 $S/$1-poster-sq.png "$2" 2>/dev/null
