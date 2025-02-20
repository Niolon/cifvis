#!/bin/bash

# Create or empty the problem_cifs directory
PROBLEM_DIR="integration-tests/logs/problem_cifs"
rm -rf "$PROBLEM_DIR"
mkdir -p "$PROBLEM_DIR"

# Process final-ortep-errors.log
while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line =~ "Failed ORTEP generation for "(.*)$ ]]; then
        # Store the filepath for next line processing
        current_file="${BASH_REMATCH[1]}"
    elif [[ $line =~ "Error: NaN values detected" && -n "$current_file" ]]; then
        # Extract filename and copy with new name
        filename=$(basename "$current_file")
        basename="${filename%.cif}"
        cp "$current_file" "$PROBLEM_DIR/nanerr_$basename.cif"
    elif [[ $line =~ "Error: Could not infer element type" && -n "$current_file" ]]; then
        filename=$(basename "$current_file")
        basename="${filename%.cif}"
        cp "$current_file" "$PROBLEM_DIR/inferelemerr_$basename.cif"
    fi
done < "integration-tests/logs/final-ortep-errors.log"

# Process modifier-test-errors.log
while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line =~ "CIF Error in "(/[^\"]+\.cif) ]]; then
        filepath="${BASH_REMATCH[1]}"
        filename=$(basename "$filepath")
        basename="${filename%.cif}"
        cp "$filepath" "$PROBLEM_DIR/ciferr_$basename.cif"
    elif [[ $line =~ "Structure Error in "(/[^\"]+\.cif) ]]; then
        filepath="${BASH_REMATCH[1]}"
        filename=$(basename "$filepath")
        basename="${filename%.cif}"
        cp "$filepath" "$PROBLEM_DIR/structerr_$basename.cif"
    fi
done < "integration-tests/logs/modifier-test-errors.log"

echo "Problematic CIF files have been copied to $PROBLEM_DIR"