"""Run a multi-statement SQL seed file against a linked Supabase project.

Usage:
    uv run python scripts/run_seed.py <sql_file>

Splits on semicolons, skips empty statements, runs each via
`supabase db query --linked`. Works on any OS.
"""

import re
import subprocess
import sys
from pathlib import Path


def split_sql(sql: str) -> list[str]:
    # Remove line comments
    sql = re.sub(r"--[^\n]*", "", sql)
    statements = [s.strip() for s in sql.split(";")]
    return [s for s in statements if s]


def main():
    if len(sys.argv) != 2:
        print("Usage: uv run python scripts/run_seed.py <sql_file>")
        sys.exit(1)

    sql_file = Path(sys.argv[1])
    if not sql_file.exists():
        print(f"File not found: {sql_file}")
        sys.exit(1)

    statements = split_sql(sql_file.read_text(encoding="utf-8"))
    print(f"Running {len(statements)} statements from {sql_file.name}...")

    for i, stmt in enumerate(statements, 1):
        result = subprocess.run(
            ["supabase", "db", "query", "--workdir", ".", "--linked", stmt],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"ERROR at statement {i}:\n{stmt[:200]}\n{result.stderr}")
            sys.exit(1)

    print("Done.")


if __name__ == "__main__":
    main()
