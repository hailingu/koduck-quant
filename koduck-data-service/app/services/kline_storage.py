"""K-line local file storage helpers.

Provides unified read/write/list operations for kline files across
multiple formats:
- CSV (legacy)
- Parquet
- Externally compressed Parquet (``.parquet.zst``)
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd

from app.config import settings

SUPPORTED_PATTERNS = ("*.parquet.zst", "*.parquet", "*.csv")


class KlineStorageError(RuntimeError):
    """Raised when kline storage read/write operation fails."""


class KlineStorage:
    """Utility class for kline local file read/write operations."""

    def __init__(
        self,
        storage_format: str | None = None,
        compression_level: int | None = None,
    ) -> None:
        self._storage_format = (storage_format or settings.KLINE_STORAGE_FORMAT).lower()
        self._compression_level = (
            compression_level
            if compression_level is not None
            else settings.KLINE_COMPRESSION_LEVEL
        )

    def build_symbol_path(self, timeframe_dir: Path, symbol: str) -> Path:
        """Build target file path by configured storage format."""
        if self._storage_format == "csv":
            suffix = ".csv"
        elif self._storage_format == "parquet":
            suffix = ".parquet"
        elif self._storage_format == "parquet.zst":
            suffix = ".parquet.zst"
        else:
            raise KlineStorageError(
                f"Unsupported KLINE_STORAGE_FORMAT: {self._storage_format}"
            )
        return timeframe_dir / f"{symbol}{suffix}"

    def discover_symbol_path(self, timeframe_dir: Path, symbol: str) -> Path:
        """Find existing file for symbol, fallback to configured target path."""
        candidates = (
            timeframe_dir / f"{symbol}.parquet.zst",
            timeframe_dir / f"{symbol}.parquet",
            timeframe_dir / f"{symbol}.csv",
        )
        for path in candidates:
            if path.exists():
                return path
        return self.build_symbol_path(timeframe_dir, symbol)

    @staticmethod
    def list_kline_files(data_dir: Path, timeframes: list[str] | None = None) -> list[Path]:
        """List all kline files under data directory."""
        if not data_dir.exists():
            return []

        dirs: list[Path]
        if timeframes:
            dirs = [data_dir / tf for tf in timeframes]
        else:
            dirs = [d for d in data_dir.iterdir() if d.is_dir()]

        files: list[Path] = []
        for directory in dirs:
            if not directory.exists():
                continue
            for pattern in SUPPORTED_PATTERNS:
                files.extend(directory.glob(pattern))
        return sorted(set(files))

    def read_dataframe(self, path: Path) -> pd.DataFrame:
        """Read dataframe from CSV/Parquet/Parquet+Zstd file."""
        suffixes = path.suffixes

        if suffixes[-2:] == [".parquet", ".zst"]:
            return self._read_parquet_zst(path)
        if path.suffix == ".parquet":
            return pd.read_parquet(path)
        if path.suffix == ".csv":
            return self.normalize_kline_columns(pd.read_csv(path, encoding="utf-8-sig"))

        raise KlineStorageError(f"Unsupported kline file extension: {path}")

    def write_dataframe(self, df: pd.DataFrame, path: Path) -> None:
        """Write dataframe atomically according to path suffix."""
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_name(f".{path.name}.tmp")
        normalized_df = self.normalize_kline_columns(df)

        suffixes = path.suffixes
        if suffixes[-2:] == [".parquet", ".zst"]:
            self._write_parquet_zst(normalized_df, tmp_path)
        elif path.suffix == ".parquet":
            normalized_df.to_parquet(
                tmp_path, index=False, engine="pyarrow", compression="zstd"
            )
        elif path.suffix == ".csv":
            normalized_df.to_csv(tmp_path, index=False, encoding="utf-8-sig")
        else:
            raise KlineStorageError(f"Unsupported kline file extension: {path}")

        tmp_path.replace(path)

    @staticmethod
    def normalize_kline_columns(df: pd.DataFrame) -> pd.DataFrame:
        """Normalize kline dataframe columns to snake_case schema."""
        if df is None or df.empty:
            return df

        normalized = df.copy()

        # Handle duplicate column names such as stime, stime.1
        if "stime.1" in normalized.columns and "stime" not in normalized.columns:
            normalized.rename(columns={"stime.1": "stime"}, inplace=True)

        rename_map = {
            "preClose": "pre_close_price",
            "pre_close": "pre_close_price",
            "suspendFlag": "is_suspended",
            "suspended": "is_suspended",
        }
        normalized.rename(columns=rename_map, inplace=True)

        # Provide normalized timestamp column for external daily CSV:
        # prefer `time`(epoch ms) over `stime`(YYYYMMDD).
        if "timestamp" not in normalized.columns:
            if "time" in normalized.columns:
                normalized["timestamp"] = pd.to_numeric(
                    normalized["time"], errors="coerce"
                )
                normalized["timestamp"] = normalized["timestamp"].map(
                    lambda v: int(v / 1000) if pd.notna(v) and v > 10**12 else (
                        int(v) if pd.notna(v) else pd.NA
                    )
                )
            elif "stime" in normalized.columns:
                stime_dt = pd.to_datetime(
                    normalized["stime"].astype(str), format="%Y%m%d", errors="coerce"
                )
                normalized["timestamp"] = pd.Series(pd.NA, index=normalized.index, dtype="Int64")
                valid_mask = stime_dt.notna()
                normalized.loc[valid_mask, "timestamp"] = (
                    stime_dt.loc[valid_mask].astype("int64") // 10**9
                ).astype("Int64")

        if "is_suspended" in normalized.columns:
            normalized["is_suspended"] = (
                pd.to_numeric(normalized["is_suspended"], errors="coerce")
                .fillna(0)
                .astype("int64")
                .map(lambda v: v == 1)
            )

        return normalized

    def _read_parquet_zst(self, path: Path) -> pd.DataFrame:
        try:
            import pyarrow.parquet as pq
            import zstandard as zstd
        except ImportError as exc:
            raise KlineStorageError(
                "Reading '.parquet.zst' requires 'pyarrow' and 'zstandard'"
            ) from exc

        with path.open("rb") as fh:
            compressed = fh.read()

        decompressed = zstd.ZstdDecompressor().decompress(compressed)
        table = pq.read_table(BytesIO(decompressed))
        return self.normalize_kline_columns(table.to_pandas())

    def _write_parquet_zst(self, df: pd.DataFrame, path: Path) -> None:
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
            import zstandard as zstd
        except ImportError as exc:
            raise KlineStorageError(
                "Writing '.parquet.zst' requires 'pyarrow' and 'zstandard'"
            ) from exc

        table = pa.Table.from_pandas(df, preserve_index=False)

        parquet_buffer = BytesIO()
        pq.write_table(table, parquet_buffer, compression="NONE")

        compressor = zstd.ZstdCompressor(level=self._compression_level)
        compressed = compressor.compress(parquet_buffer.getvalue())

        with path.open("wb") as fh:
            fh.write(compressed)
