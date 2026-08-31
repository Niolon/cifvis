#!/usr/bin/env bash
# Run the current CifVis bundle against the existing local JSMol/Django
# publication harness. JSMol assets remain external and are never copied here.
set -euo pipefail

OUTPUT_DIR=${1:?usage: run-jsmol-comparison.sh OUTPUT_DIR}
HARNESS_DIR=${JSMOL_HARNESS_DIR:-/home/niklas/Documents/tryDjango/django_performance_comp}
MAMBA_ENV=${JSMOL_MAMBA_ENV:-/home/niklas/Documents/tryDjango/.mamba/envs/my-mamba-environment}
SAMPLE_FILE=${JSMOL_SAMPLE_FILE:?set JSMOL_SAMPLE_FILE to the generated campaign sample}
CHROME_PATH=${CHROME_PATH:-/run/current-system/sw/bin/google-chrome-stable}
DRIVER_DIR="$HARNESS_DIR/benchmark-driver"
DATABASE="$HARNESS_DIR/db.sqlite3"
JSMOL_PROPERTIES="$HARNESS_DIR/static/js/jsmol/j2s/Jmol.properties"
SQLITE_COMPAT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sqlite-cli.py"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PID=''

cleanup () {
    if [[ -n "$SERVER_PID" ]]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
for required in \
    "$MAMBA_ENV/bin/python" \
    "$DRIVER_DIR/run-benchmark.mjs" \
    "$DRIVER_DIR/export-csv.mjs" \
    "$HARNESS_DIR/static/js/jsmol/JSmol.min.js" \
    "$JSMOL_PROPERTIES" \
    "$SAMPLE_FILE" \
    "$SQLITE_COMPAT"; do
    [[ -e "$required" ]] || { echo "Missing comparison dependency: $required" >&2; exit 2; }
done
[[ ! -e "$OUTPUT_DIR/database-before-run.sqlite3" ]] || {
    echo "Refusing to replace existing comparison output in $OUTPUT_DIR" >&2
    exit 2
}

export PATH="$MAMBA_ENV/bin:$PATH"
{
    echo "generated_at=$(date --iso-8601=seconds)"
    echo "harness_commit=$(git -C "$HARNESS_DIR" rev-parse HEAD)"
    echo "harness_status_begin"
    git -C "$HARNESS_DIR" status --short
    echo "harness_status_end"
    echo "sample_sha256=$(sha256sum "$SAMPLE_FILE" | cut -d' ' -f1)"
    sed -n 's/^Jmol\.___JmolVersion="\([^"]*\)".*/jsmol_version=\1/p' "$JSMOL_PROPERTIES"
    sha256sum \
        "$DRIVER_DIR/run-benchmark.mjs" \
        "$DRIVER_DIR/export-csv.mjs" \
        "$HARNESS_DIR/templates/cifvis.html" \
        "$HARNESS_DIR/templates/jsmol.html" \
        "$HARNESS_DIR/static/js/performance_measurement.js" \
        "$HARNESS_DIR/static/js/jsmol/JSmol.min.js"
    "$CHROME_PATH" --version 2>/dev/null || true
} > "$OUTPUT_DIR/harness-provenance.txt"
if [[ -e "$HARNESS_DIR/static/js/cifvis.alldeps.js" ]]; then
    cp "$HARNESS_DIR/static/js/cifvis.alldeps.js" "$OUTPUT_DIR/cifvis-bundle-before-run.js"
fi
cd "$REPO_ROOT"
npm run build:alldeps
cp dist/cifvis.alldeps.js "$HARNESS_DIR/static/js/cifvis.alldeps.js"
cp dist/cifvis.alldeps.js "$OUTPUT_DIR/cifvis-bundle-measured.js"

# Preserve the prior harness database and create a clean measurement database.
if [[ -e "$DATABASE" ]]; then
    mv "$DATABASE" "$OUTPUT_DIR/database-before-run.sqlite3"
fi
"$MAMBA_ENV/bin/python" "$HARNESS_DIR/manage.py" migrate --noinput \
    > "$OUTPUT_DIR/django-migrate.log" 2>&1
"$MAMBA_ENV/bin/python" "$HARNESS_DIR/manage.py" runserver --noreload 127.0.0.1:8123 \
    > "$OUTPUT_DIR/django-server.log" 2>&1 &
SERVER_PID=$!

ready=0
for _attempt in {1..60}; do
    if curl --silent --fail http://127.0.0.1:8123/ > /dev/null; then
        ready=1
        break
    fi
    sleep 1
done
[[ "$ready" -eq 1 ]] || { echo "Django harness did not become ready" >&2; exit 1; }

cd "$DRIVER_DIR"
NUM_BROWSERS=1 PAGES_PER_BROWSER=1 LOADING_METHODS=preloaded SAMPLE_FILE="$SAMPLE_FILE" \
    SQLITE3_PATH="$SQLITE_COMPAT" node run-benchmark.mjs
DB_PATH="$DATABASE" SQLITE3_PATH="$SQLITE_COMPAT" \
    node export-csv.mjs "$OUTPUT_DIR/jsmol-comparison.csv"
cp "$DATABASE" "$OUTPUT_DIR/jsmol-comparison.sqlite3"
cd "$REPO_ROOT"
JSMOL_LOADING_METHODS=preloaded node benchmark/summarize-jsmol-comparison.mjs \
    "$OUTPUT_DIR/jsmol-comparison.csv" "$SAMPLE_FILE" \
    "$OUTPUT_DIR/jsmol-comparison-summary.json"
