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
    elif [[ $line =~ "Modifier Error in "(/[^\"]+\.cif) ]]; then
        filepath="${BASH_REMATCH[1]}"
        filename=$(basename "$filepath")
        basename="${filename%.cif}"
        cp "$filepath" "$PROBLEM_DIR/moderr_$basename.cif"
    elif [[ $line =~ "Connectivity Error in "(/[^\"]+\.cif) ]]; then
        filepath="${BASH_REMATCH[1]}"
        filename=$(basename "$filepath")
        basename="${filename%.cif}"
        cp "$filepath" "$PROBLEM_DIR/connerr_$basename.cif"
    fi
done < "integration-tests/logs/modifier-test-errors.log"

# Process modifier-test-bond-consistency.log. This log holds only findings that the
# source CIF does not account for - a structure that verifies against its own
# coordinates but still grows into bonds of the wrong length, or bonds naming an atom
# that was never materialised. These are cifvis's own defects, so unlike the other
# categories the aim is to drive this set to empty.
BOND_LOG="integration-tests/logs/modifier-test-bond-consistency.log"
if [[ -f "$BOND_LOG" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ $line =~ "Bond consistency in "(/[^\"]+\.cif) ]]; then
            filepath="${BASH_REMATCH[1]}"
            filename=$(basename "$filepath")
            basename="${filename%.cif}"
            cp "$filepath" "$PROBLEM_DIR/bonderr_$basename.cif"
        fi
    done < "$BOND_LOG"
fi

echo "Problematic CIF files have been copied to $PROBLEM_DIR"
echo "  bonderr_ (cifvis defects, target: zero): $(ls "$PROBLEM_DIR"/bonderr_*.cif 2>/dev/null | wc -l)"
echo "  total:                                   $(ls "$PROBLEM_DIR"/*.cif 2>/dev/null | wc -l)"