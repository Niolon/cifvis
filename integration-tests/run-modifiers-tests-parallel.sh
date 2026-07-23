#!/bin/bash

# Runs test-structure-modifiers.mjs in parallel over disjoint file-index chunks,
# then merges the per-chunk logs/stats back into the same top-level files
# test-structure-modifiers.mjs itself would produce for an unchunked run.
#
# Usage: integration-tests/run-modifiers-tests-parallel.sh [COD_DIR] [WORKERS] [CHUNK_SIZE]

COD_DIR=${1:-"../cod"}
WORKERS=${2:-12}
CHUNK_SIZE=${3:-2000}
NODE_ARGS="--expose-gc --max-old-space-size=4096"
BASE_LOGS_DIR="integration-tests/logs"
CHUNK_LOGS_DIR="$BASE_LOGS_DIR/modifiers-chunked"

mkdir -p "$BASE_LOGS_DIR"

if [ -d "$CHUNK_LOGS_DIR" ]; then
    echo "Cleaning existing modifiers-chunked directory..."
    rm -rf "$CHUNK_LOGS_DIR"
fi
mkdir -p "$CHUNK_LOGS_DIR"

echo "Counting CIF files in $COD_DIR..."
TOTAL_FILES=$(find "$COD_DIR" -name "*.cif" | wc -l)
echo "Found $TOTAL_FILES CIF files"

NUM_CHUNKS=$(( (TOTAL_FILES + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "Will process in $NUM_CHUNKS chunks of $CHUNK_SIZE files each, $WORKERS at a time"

START_TIME=$(date +%s)

for ((i = 0; i < NUM_CHUNKS; i++)); do
    START=$((i * CHUNK_SIZE))
    END=$((START + CHUNK_SIZE))

    # Cap concurrency at $WORKERS: once that many background jobs are running,
    # wait for any one of them to finish before starting the next.
    while [ "$(jobs -r -p | wc -l)" -ge "$WORKERS" ]; do
        wait -n
    done

    echo "Launching chunk $((i + 1))/$NUM_CHUNKS (files $START-$END)"
    node $NODE_ARGS integration-tests/test-structure-modifiers.mjs "$COD_DIR" "$START" "$END" \
        > "$CHUNK_LOGS_DIR/stdout-$START-$END.log" 2>&1 &
done

echo "Waiting for all chunks to finish..."
wait

END_TIME=$(date +%s)
echo "All chunks completed in $((END_TIME - START_TIME))s. Aggregating results..."

node integration-tests/aggregate-modifier-stats.mjs

echo "Done. Merged summary: $BASE_LOGS_DIR/modifier-test-summary.log"
echo "Merged errors: $BASE_LOGS_DIR/modifier-test-errors.log"
echo "Per-chunk stdout/stderr logs (for diagnosing a crashed chunk): $CHUNK_LOGS_DIR/stdout-*.log"
