#!/usr/bin/env bash
# Builds dist/ardan-online.zip – the deploy package (no node_modules, no data, no .env, no tests/dev tools).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist/ardan-online.zip; STAGE=$(mktemp -d)/ardan-online
mkdir -p dist "$STAGE"
git ls-files | grep -vE '^(demo|shots|data|dist|test|engine-src)/|(^|/)\.env$|\.db(-wal|-shm)?$' > /tmp/ardan-pack.txt
echo DEPLOY_PL.md >> /tmp/ardan-pack.txt
sort -u /tmp/ardan-pack.txt | while read -r f; do [ -f "$f" ] && mkdir -p "$STAGE/$(dirname "$f")" && cp "$f" "$STAGE/$f"; done
# package.json for production: no test scripts / dev dependencies
node -e "
const p=require('$STAGE/package.json');
for (const k of Object.keys(p.scripts)) if (/^test|^build:engine$|^pack$/.test(k)) delete p.scripts[k];
require('fs').writeFileSync('$STAGE/package.json', JSON.stringify(p,null,2)+'\n');"
# safety checks
! grep -rqs "ARDAN_TEST_HOOKS: *'1'\|ARDAN_TEST_HOOKS=1" "$STAGE"/render*.yaml "$STAGE"/Dockerfile "$STAGE"/fly.toml
[ ! -e "$STAGE/.env" ] && [ ! -d "$STAGE/node_modules" ] && [ ! -d "$STAGE/data" ]
rm -f "$OUT"
python3 - "$STAGE" "$OUT" <<'PY'
import os, sys, zipfile
stage, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(stage); n = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(stage):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(root, f); z.write(p, os.path.relpath(p, base)); n += 1
print(f"{out}: {os.path.getsize(out)} bytes, {n} files")
PY
