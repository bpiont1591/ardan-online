#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 build.py >/dev/null
python3 mp.py
python3 tb.py
python3 r4.py
python3 r5.py
python3 r7.py
python3 r8.py
python3 r9.py
npx tsc --strict --target ES2019 --lib ES2020,DOM --outDir out engine.ts
cp out/engine.js ../public/js/engine.js
{ cat out/engine.js; echo; echo 'module.exports = { createArdan };'; } > ../server/engine.js
echo built
