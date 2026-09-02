#!/bin/bash
set -uo pipefail

# Configuration
CHUNK_SIZE=2000
COD_INPUT=${1:-"../cod"}  # Directory, CIF, or file manifest
RESUME=${2:-}
NODE_ARGS="--expose-gc --max-old-space-size=8192"
BASE_LOGS_DIR="${CIFVIS_INTEGRATION_LOG_DIR:-integration-tests/logs}"
CHUNK_LOGS_DIR="$BASE_LOGS_DIR/ortep-chunked"
FINAL_SUMMARY="$BASE_LOGS_DIR/final-ortep-summary.log"
FINAL_ERRORS="$BASE_LOGS_DIR/final-ortep-errors.log"

# Create base logs directory if it doesn't exist
mkdir -p "$BASE_LOGS_DIR"

# Handle ortep-chunked directory. In resume mode, a completed chunk is
# identified by its final summary file and is never rerun.
if [ "$RESUME" = "--resume" ]; then
    if [ ! -d "$CHUNK_LOGS_DIR" ]; then
        echo "Cannot resume: no existing chunk log directory at $CHUNK_LOGS_DIR" >&2
        exit 2
    fi
    echo "Resuming from completed chunk summaries in $CHUNK_LOGS_DIR..."
elif [ -d "$CHUNK_LOGS_DIR" ]; then
    echo "Cleaning existing ortep-chunked directory..."
    rm -rf "$CHUNK_LOGS_DIR"
fi
mkdir -p "$CHUNK_LOGS_DIR"

# Count total CIF files
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

# Calculate number of chunks needed
NUM_CHUNKS=$(( (TOTAL_FILES + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "Will process in $NUM_CHUNKS chunks of $CHUNK_SIZE files each"

# Clear final output files
> "$FINAL_SUMMARY"
> "$FINAL_ERRORS"

# Variables for aggregated statistics
TOTAL_PROCESSED=0
TOTAL_SUCCESSFUL=0
TOTAL_STRUCTURE_ERRORS=0
TOTAL_ORTEP_ERRORS=0
TOTAL_NAN_ERRORS=0
FAILED_CHUNKS=0

# Process each chunk
for ((i=0; i<NUM_CHUNKS; i++)); do
    START=$((i * CHUNK_SIZE))
    END=$((START + CHUNK_SIZE))
    SUMMARY_FILE="$CHUNK_LOGS_DIR/ortep-test-summary-$START-$END.log"
    ERROR_FILE="$CHUNK_LOGS_DIR/ortep-test-errors-$START-$END.log"
    
    echo "Processing chunk $((i+1))/$NUM_CHUNKS (files $START to $END)"
    if [ "$RESUME" = "--resume" ] && [ -f "$SUMMARY_FILE" ]; then
        echo "Skipping completed chunk $START-$END"
    else
        # Run test script for this chunk.
        if ! node $NODE_ARGS integration-tests/test-ortep.mjs "$COD_INPUT" $START $END; then
            echo "Chunk $START-$END failed." >&2
            FAILED_CHUNKS=$((FAILED_CHUNKS + 1))
            continue
        fi
    fi
    
    # Append errors to final error file
    if [ -f "$ERROR_FILE" ]; then
        echo -e "\n=== Errors from files $START-$END ===\n" >> "$FINAL_ERRORS"
        cat "$ERROR_FILE" >> "$FINAL_ERRORS"
    fi
    
    # Extract statistics from this chunk's summary
    if [ -f "$SUMMARY_FILE" ]; then
        # Extract numbers using grep and sed
        PROCESSED=$(grep "Total files processed:" "$SUMMARY_FILE" | grep -o '[0-9]*')
        SUCCESSFUL=$(grep "Successful ORTEP generation:" "$SUMMARY_FILE" | grep -o '[0-9]*' | head -1)
        STRUCTURE_ERRORS=$(grep "Structure errors:" "$SUMMARY_FILE" | grep -o '[0-9]*')
        ORTEP_ERRORS=$(grep "ORTEP creation errors:" "$SUMMARY_FILE" | grep -o '[0-9]*')
        NAN_ERRORS=$(grep "Structures with NaN values:" "$SUMMARY_FILE" | grep -o '[0-9]*')
        
        # Add to totals
        TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
        TOTAL_SUCCESSFUL=$((TOTAL_SUCCESSFUL + SUCCESSFUL))
        TOTAL_STRUCTURE_ERRORS=$((TOTAL_STRUCTURE_ERRORS + STRUCTURE_ERRORS))
        TOTAL_ORTEP_ERRORS=$((TOTAL_ORTEP_ERRORS + ORTEP_ERRORS))
        TOTAL_NAN_ERRORS=$((TOTAL_NAN_ERRORS + NAN_ERRORS))
    fi
done

# Calculate final percentages
if [ $TOTAL_PROCESSED -gt 0 ]; then
    SUCCESS_PERCENT=$(awk -v successful="$TOTAL_SUCCESSFUL" -v total="$TOTAL_PROCESSED" \
        'BEGIN { printf "%.1f", successful * 100 / total }')
else
    SUCCESS_PERCENT="0.0"
fi

# Write final summary
cat << EOF > "$FINAL_SUMMARY"
Final ORTEP Testing Summary
==========================
Total files processed: $TOTAL_PROCESSED
Successful ORTEP generation: $TOTAL_SUCCESSFUL ($SUCCESS_PERCENT%)

Errors:
- Structure errors: $TOTAL_STRUCTURE_ERRORS
- ORTEP creation errors: $TOTAL_ORTEP_ERRORS
- Structures with NaN values: $TOTAL_NAN_ERRORS

Test completed on $(date)
Individual chunk logs can be found in: $CHUNK_LOGS_DIR
EOF

echo "Testing completed. Final results:"
cat "$FINAL_SUMMARY"
echo -e "\nDetailed errors can be found in $FINAL_ERRORS"
echo -e "Individual chunk logs can be found in $CHUNK_LOGS_DIR"

if [ "$FAILED_CHUNKS" -gt 0 ]; then
    echo "$FAILED_CHUNKS ORTEP chunk(s) failed; summary is partial." >&2
    exit 1
fi
