from __future__ import annotations

import csv
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = Path("/Users/guhailin/Git/koduck-quant/koduck-data-service/data/kline/1D")
BJ = timezone(timedelta(hours=8))


def expected_date_str_from_ts(ts_str: str) -> str | None:
    try:
        ts = int(float(ts_str))
    except Exception:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(BJ).strftime("%Y-%m-%d")


def main() -> None:
    files = sorted(BASE.glob("*.csv"))
    summary = {
        "files": 0,
        "symbol_bad_files": 0,
        "datetime_bad_files": 0,
        "filename_symbol_mismatch_files": 0,
    }
    issues: list[dict[str, int | str]] = []

    for path in files:
        summary["files"] += 1
        symbol_bad = 0
        datetime_bad = 0
        filename_mismatch = 0

        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                symbol = (row.get("symbol") or "").strip()
                dt = (row.get("datetime") or "").strip()
                ts = (row.get("timestamp") or "").strip()

                if not (len(symbol) == 6 and symbol.isdigit()):
                    symbol_bad += 1
                if symbol and symbol != path.stem:
                    filename_mismatch += 1

                expected = expected_date_str_from_ts(ts)
                if expected is None or dt != expected:
                    datetime_bad += 1

        if symbol_bad > 0:
            summary["symbol_bad_files"] += 1
        if datetime_bad > 0:
            summary["datetime_bad_files"] += 1
        if filename_mismatch > 0:
            summary["filename_symbol_mismatch_files"] += 1

        if symbol_bad or datetime_bad or filename_mismatch:
            issues.append(
                {
                    "file": path.name,
                    "symbol_bad": symbol_bad,
                    "datetime_bad": datetime_bad,
                    "filename_mismatch": filename_mismatch,
                }
            )

    print("SUMMARY", summary)
    print("ISSUES", issues if issues else "none")


if __name__ == "__main__":
    main()
