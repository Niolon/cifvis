#!/bin/bash

# Configuration
CHUNK_SIZE=2000
COD_DIR=${1:-"../cod"}  # Use first argument as COD directory or default to ../cod
NODE_ARGS="--expose-gc --max-old-space-size=8192"
BASE_LOGS_DIR="integration-tests/logs"
CHUNK_LOGS_DIR="$BASE_LOGS_DIR/ortep-chunked"
FINAL_SUMMARY="$BASE_LOGS_DIR/final-ortep-summary.log"
FINAL_ERRORS="$BASE_LOGS_DIR/final-ortep-errors.log"

# Create base logs directory if it doesn't exist
mkdir -p "$BASE_LOGS_DIR"

# Handle ortep-chunked directory
if [ -d "$CHUNK_LOGS_DIR" ]; then
    echo "Cleaning existing ortep-chunked directory..."
    rm -rf "$CHUNK_LOGS_DIR"
fi
mkdir -p "$CHUNK_LOGS_DIR"

# Count total CIF files
echo "Counting CIF files in $COD_DIR..."
TOTAL_FILES=$(find "$COD_DIR" -name "*.cif" | wc -l)
echo "Found $TOTAL_FILES CIF files"

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

# Process each chunk
for ((i=0; i<NUM_CHUNKS; i++)); do
    START=$((i * CHUNK_SIZE))
    END=$((START + CHUNK_SIZE))
    
    echo "Processing chunk $((i+1))/$NUM_CHUNKS (files $START to $END)"
    
    # Run test script for this chunk
    node $NODE_ARGS integration-tests/test-ortep.mjs "$COD_DIR" $START $END
    
    # Append errors to final error file
    ERROR_FILE="$CHUNK_LOGS_DIR/ortep-test-errors-$START-$END.log"
    if [ -f "$ERROR_FILE" ]; then
        echo -e "\n=== Errors from files $START-$END ===\n" >> "$FINAL_ERRORS"
        cat "$ERROR_FILE" >> "$FINAL_ERRORS"
    fi
    
    # Extract statistics from this chunk's summary
    SUMMARY_FILE="$CHUNK_LOGS_DIR/ortep-test-summary-$START-$END.log"
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
    SUCCESS_PERCENT=$(echo "scale=1; $TOTAL_SUCCESSFUL * 100 / $TOTAL_PROCESSED" | bc)
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