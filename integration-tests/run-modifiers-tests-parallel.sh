#!/bin/bash

# Runs test-structure-modifiers.mjs in parallel over disjoint file-index chunks,
# then merges the per-chunk logs/stats back into the same top-level files
# test-structure-modifiers.mjs itself would produce for an unchunked run.
#
# Usage: integration-tests/run-modifiers-tests-parallel.sh [COD_INPUT] [WORKERS] [CHUNK_SIZE]

COD_INPUT=${1:-"../cod"}
WORKERS=${2:-12}
CHUNK_SIZE=${3:-2000}
NODE_ARGS="--expose-gc --max-old-space-size=4096"
BASE_LOGS_DIR="${CIFVIS_INTEGRATION_LOG_DIR:-integration-tests/logs}"
CHUNK_LOGS_DIR="$BASE_LOGS_DIR/modifiers-chunked"

mkdir -p "$BASE_LOGS_DIR"

if [ -d "$CHUNK_LOGS_DIR" ]; then
    echo "Cleaning existing modifiers-chunked directory..."
    rm -rf "$CHUNK_LOGS_DIR"
fi
mkdir -p "$CHUNK_LOGS_DIR"

echo "Counting CIF files in $COD_INPUT..."
if [ -d "$COD_INPUT" ]; then
    TOTAL_FILES=$(find "$COD_INPUT" -name "*.cif" | wc -l)
elif [ -f "$COD_INPUT" ] && [[ "$COD_INPUT" == *.cif ]]; then
    TOTAL_FILES=1
elif [ -f "$COD_INPUT" ]; then
    TOTAL_FILES=$(awk 'NF && $1 !~ /^#/ { count++ } END { print count + 0 }' "$COD_INPUT")
else
    echo "COD input not found: $COD_INPUT" >&2
    exit 2
fi
echo "Found $TOTAL_FILES CIF files"
if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "No CIF files found in $COD_INPUT" >&2
    exit 2
fi

NUM_CHUNKS=$(( (TOTAL_FILES + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "Will process in $NUM_CHUNKS chunks of $CHUNK_SIZE files each, $WORKERS at a time"

START_TIME=$(date +%s)
ACTIVE_JOBS=0
FAILED_CHUNKS=0

reap_one () {
    if ! wait -n; then
        FAILED_CHUNKS=$((FAILED_CHUNKS + 1))
    fi
    ACTIVE_JOBS=$((ACTIVE_JOBS - 1))
}

for ((i = 0; i < NUM_CHUNKS; i++)); do
    START=$((i * CHUNK_SIZE))
    END=$((START + CHUNK_SIZE))

    # Cap concurrency at $WORKERS: once that many background jobs are running,
    # wait for any one of them to finish before starting the next.
    while [ "$ACTIVE_JOBS" -ge "$WORKERS" ]; do
        reap_one
    done

    echo "Launching chunk $((i + 1))/$NUM_CHUNKS (files $START-$END)"
    node $NODE_ARGS integration-tests/test-structure-modifiers.mjs "$COD_INPUT" "$START" "$END" \
        > "$CHUNK_LOGS_DIR/stdout-$START-$END.log" 2>&1 &
    ACTIVE_JOBS=$((ACTIVE_JOBS + 1))
done

echo "Waiting for all chunks to finish..."
while [ "$ACTIVE_JOBS" -gt 0 ]; do
    reap_one
done

if [ "$FAILED_CHUNKS" -gt 0 ]; then
    echo "$FAILED_CHUNKS modifier chunk(s) failed; refusing to publish a partial aggregate." >&2
    exit 1
fi

END_TIME=$(date +%s)
echo "All chunks completed in $((END_TIME - START_TIME))s. Aggregating results..."

node integration-tests/aggregate-modifier-stats.mjs

echo "Done. Merged summary: $BASE_LOGS_DIR/modifier-test-summary.log"
echo "Merged errors: $BASE_LOGS_DIR/modifier-test-errors.log"
echo "Per-chunk stdout/stderr logs (for diagnosing a crashed chunk): $CHUNK_LOGS_DIR/stdout-*.log"
