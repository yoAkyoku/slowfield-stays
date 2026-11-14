#!/usr/bin/env bash
#
# Regenerate backend/requirements.lock.
#
# Resolves for the IMAGE's platform, not this machine's. That distinction is the
# whole point: the image is linux/x86_64 CPython 3.11, and a developer venv on
# Windows/3.13 resolves a different set — pinning from the wrong one produces a
# lock that cannot install where it has to.
#
# Two ways, in order of preference:
#   1. inside the real base image, when Docker is running (exact);
#   2. pip's cross-environment resolver, which needs no Docker.
#
# Both need network access to PyPI. Neither installs anything into this repo.
#
# Usage: bash scripts/lock-backend-deps.sh
set -euo pipefail
cd "$(dirname "$0")/../backend"

OUT="requirements.lock"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

emit_header() {
  cat <<'HEADER'
# Pinned runtime dependencies for the backend image. GENERATED - do not hand-edit.
#
# Regenerate with:  bash scripts/lock-backend-deps.sh
#
# pyproject.toml declares every dependency as `>=` with no upper bound. Without
# this file the image installs whatever is newest on PyPI at build time, so the
# same commit produces a different image each time and there is no rolling back
# to a known-good backend.
#
# Resolved for the image's platform: linux/x86_64, CPython 3.11.
HEADER
}

if docker info >/dev/null 2>&1; then
  echo "==> resolving inside python:3.11-slim (exact)"
  docker run --rm -v "$(pwd)/pyproject.toml:/tmp/pyproject.toml:ro" python:3.11-slim \
    sh -c 'cd /tmp && mkdir -p app && : > app/__init__.py \
           && pip install --quiet --no-cache-dir . >/dev/null \
           && pip freeze --exclude-editable' \
    | grep -v '^slowfield-backend' > "$TMP/pins"
else
  echo "==> Docker is not running; using pip's cross-environment resolver"
  python -m pip install --dry-run --quiet --report "$TMP/report.json" \
    --ignore-installed --only-binary=:all: \
    --python-version 3.11 --platform manylinux2014_x86_64 \
    --target "$TMP/unused" . >/dev/null
  python - "$TMP/report.json" > "$TMP/pins" <<'PY'
import json, sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
for item in report["install"]:
    meta = item["metadata"]
    if meta["name"].lower() == "slowfield-backend":
        continue
    print(f'{meta["name"]}=={meta["version"]}')
PY
fi

[ -s "$TMP/pins" ] || { echo "FAIL: resolver produced no pins" >&2; exit 1; }
n="$(wc -l < "$TMP/pins")"
[ "$n" -ge 10 ] || { echo "FAIL: only $n pins — that is not the whole tree" >&2; exit 1; }

{ emit_header; sort -f "$TMP/pins"; } > "$OUT"
echo "==> wrote $OUT ($n pins)"
echo "    Review the diff before committing; a version change here changes the image."
