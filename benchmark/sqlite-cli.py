#!/usr/bin/env python3
"""Minimal sqlite3 CLI compatibility for the external comparison harness."""

import json
import sqlite3
import sys


def main() -> int:
    """Execute one query in pipe-separated or sqlite3 ``-json`` mode."""
    args = sys.argv[1:]
    if len(args) not in (2, 3):
        print("usage: sqlite-cli.py DATABASE [-json] QUERY", file=sys.stderr)
        return 2

    database = args[0]
    json_mode = len(args) == 3 and args[1] == "-json"
    query = args[-1]
    if len(args) == 3 and not json_mode:
        print(f"unsupported option: {args[1]}", file=sys.stderr)
        return 2

    with sqlite3.connect(database) as connection:
        cursor = connection.execute(query)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description or []]

    if json_mode:
        print(json.dumps([dict(zip(columns, row)) for row in rows]))
    else:
        for row in rows:
            print("|".join("" if value is None else str(value) for value in row))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
