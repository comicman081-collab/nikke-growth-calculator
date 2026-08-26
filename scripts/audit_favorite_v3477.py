#!/usr/bin/env python3
"""Produce a compact, reviewable audit of ENIKK favorite-item data and app consumption.

No master IDs or phase values are assumed here.  The script records only values found in
ENIKK_v1.0.6.apk or in the checked-out calculator source so the V34.7.7 patch can be
based on evidence rather than guessed constants.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "enikk_unpacked")
OUT = Path("audit")
OUT.mkdir(parents=True, exist_ok=True)

TARGET_NAMES = ("Poli", "Sugar", "Laplace", "폴리", "슈가", "라플라스")
STRUCTURE_TERMS = (
    "favoriteItemPhase",
    "favorite_item_phase",
    "favoriteitemphase",
    "favorite item",
    "favorite_item",
    "favoriteitem",
    "treasure",
    "phase_level",
    "phaselevel",
    "애장품",
)
SCHEMA_TERMS = (
    "favorite", "treasure", "phase", "skill", "character", "item", "tid", "master"
)
TEXT_SUFFIXES = {
    ".json", ".jsonl", ".txt", ".csv", ".tsv", ".xml", ".yaml", ".yml",
    ".js", ".dart", ".html", ".md", ".properties", ".arsc", ".map"
}
MAX_SCAN_BYTES = 96 * 1024 * 1024
MAX_HITS = 2500
MAX_HITS_PER_FILE = 120
CONTEXT = 700


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def squash(value: Any, limit: int = 1800) -> str:
    text = str(value).replace("\x00", " ")
    text = re.sub(r"[\t\r ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:limit]


def context_hits(text: str, needles: Iterable[str], *, limit: int = 100) -> list[dict[str, Any]]:
    lower = text.casefold()
    found: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    for needle in needles:
        nl = needle.casefold()
        start = 0
        while len(found) < limit:
            pos = lower.find(nl, start)
            if pos < 0:
                break
            key = (nl, pos)
            if key not in seen:
                seen.add(key)
                lo = max(0, pos - CONTEXT)
                hi = min(len(text), pos + len(needle) + CONTEXT)
                found.append({
                    "needle": needle,
                    "offset": pos,
                    "context": squash(text[lo:hi]),
                })
            start = pos + max(1, len(nl))
    return found


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def json_safe_row(row: Iterable[Any]) -> list[Any]:
    out: list[Any] = []
    for value in row:
        if isinstance(value, bytes):
            out.append({"bytes_hex": value[:96].hex(), "length": len(value)})
        elif value is None or isinstance(value, (str, int, float, bool)):
            out.append(value)
        else:
            out.append(str(value))
    return out


report: dict[str, Any] = {
    "audit_version": 2,
    "principle": "No TID, phase, or skill mapping is assumed; every recorded value comes from source bytes or checked-out app code.",
    "enikk_root": str(ROOT),
    "provenance": {},
    "inventory": {},
    "app": {},
    "sqlite": [],
    "text_and_binary_hits": [],
    "urls": [],
    "warnings": [],
}

apk = Path("enikk.apk")
if apk.exists():
    report["provenance"]["apk"] = {
        "path": str(apk),
        "bytes": apk.stat().st_size,
        "sha256": sha256(apk),
    }
else:
    report["warnings"].append("enikk.apk was not present beside the extracted directory")

if not ROOT.exists():
    raise SystemExit(f"missing extracted APK directory: {ROOT}")

all_files: list[Path] = []
for p in ROOT.rglob("*"):
    if p.is_file():
        all_files.append(p)
all_files.sort(key=lambda p: str(p).lower())

report["inventory"]["file_count"] = len(all_files)
report["inventory"]["total_bytes"] = sum(p.stat().st_size for p in all_files)
report["inventory"]["largest_files"] = [
    {"path": str(p), "bytes": p.stat().st_size}
    for p in sorted(all_files, key=lambda p: p.stat().st_size, reverse=True)[:160]
]
path_terms = tuple(x.casefold() for x in (*SCHEMA_TERMS, "fav"))
report["inventory"]["relevant_paths"] = [
    {"path": str(p), "bytes": p.stat().st_size}
    for p in all_files
    if any(term in str(p).casefold() for term in path_terms)
][:1200]

# Record the calculator's actual consumer code before looking at ENIKK data.
index = Path("index.html")
if index.exists():
    app_text = index.read_text("utf-8", errors="replace")
    app_needles = (*STRUCTURE_TERMS, *TARGET_NAMES, "V34.7.6", "34.7.6")
    app_hits = context_hits(app_text, app_needles, limit=260)
    report["app"] = {
        "index_bytes": index.stat().st_size,
        "index_sha256": sha256(index),
        "hits": app_hits,
        "favoriteItemPhase_exact_count": app_text.count("favoriteItemPhase"),
        "candidate_numeric_tokens_near_hits": sorted({
            token
            for hit in app_hits
            for token in re.findall(r"(?<!\d)\d{5,14}(?!\d)", hit["context"])
        }),
    }
else:
    report["warnings"].append("index.html was not present in the workflow checkout")

# Inspect every SQLite payload by magic bytes, not by extension.
row_needles = tuple(dict.fromkeys((*TARGET_NAMES, *STRUCTURE_TERMS)))
for path in all_files:
    try:
        with path.open("rb") as f:
            magic = f.read(16)
    except OSError as exc:
        report["warnings"].append(f"cannot read {path}: {exc}")
        continue
    if magic != b"SQLite format 3\x00":
        continue

    db_entry: dict[str, Any] = {
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "tables": [],
    }
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        conn.row_factory = None
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )]
        for table in tables:
            qtable = quote_ident(table)
            columns = [r[1] for r in conn.execute(f"PRAGMA table_info({qtable})")]
            try:
                create_sql_row = conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
                ).fetchone()
                create_sql = create_sql_row[0] if create_sql_row else None
            except sqlite3.Error:
                create_sql = None
            try:
                row_count = int(conn.execute(f"SELECT COUNT(*) FROM {qtable}").fetchone()[0])
            except sqlite3.Error:
                row_count = -1

            schema_blob = (table + " " + " ".join(columns)).casefold()
            schema_relevant = any(term in schema_blob for term in SCHEMA_TERMS)
            table_entry: dict[str, Any] = {
                "name": table,
                "columns": columns,
                "row_count": row_count,
                "create_sql": create_sql,
                "schema_relevant": schema_relevant,
                "matched_rows": [],
            }

            if columns:
                conditions: list[str] = []
                params: list[str] = []
                for needle in row_needles:
                    for col in columns:
                        conditions.append(f"CAST({quote_ident(col)} AS TEXT) LIKE ?")
                        params.append(f"%{needle}%")
                sql = f"SELECT * FROM {qtable} WHERE " + " OR ".join(conditions) + " LIMIT 700"
                try:
                    matched = conn.execute(sql, params).fetchall()
                    table_entry["matched_rows"] = [json_safe_row(r) for r in matched]
                except sqlite3.Error as exc:
                    table_entry["match_error"] = str(exc)

            if schema_relevant and row_count and row_count > 0:
                try:
                    preview = conn.execute(f"SELECT * FROM {qtable} LIMIT 80").fetchall()
                    table_entry["schema_preview_rows"] = [json_safe_row(r) for r in preview]
                except sqlite3.Error as exc:
                    table_entry["preview_error"] = str(exc)

            db_entry["tables"].append(table_entry)
        conn.close()
    except Exception as exc:  # keep the remaining audit alive
        db_entry["error"] = repr(exc)
    report["sqlite"].append(db_entry)

# Scan text and native Flutter payloads for exact terms and discover network endpoints.
scan_needles = tuple(dict.fromkeys((*TARGET_NAMES, *STRUCTURE_TERMS)))
url_re = re.compile(r"https?://[^\s\x00\"'<>\\]{4,500}", re.IGNORECASE)
url_seen: set[str] = set()
for path in all_files:
    if len(report["text_and_binary_hits"]) >= MAX_HITS:
        report["warnings"].append("global hit cap reached")
        break
    try:
        size = path.stat().st_size
    except OSError:
        continue
    if size <= 0 or size > MAX_SCAN_BYTES:
        continue
    suffix = path.suffix.lower()
    name_low = path.name.casefold()
    should_scan = (
        suffix in TEXT_SUFFIXES
        or suffix in {".so", ".db", ".sqlite", ".sqlite3", ".bin", ".dat", ".blob"}
        or "flutter" in str(path).casefold()
        or "asset" in str(path).casefold()
        or any(term in name_low for term in path_terms)
    )
    if not should_scan:
        continue
    try:
        data = path.read_bytes()
    except OSError:
        continue

    # UTF-8 ignore is effective for JSON, Dart snapshots, resources, and libapp.so string pools.
    text = data.decode("utf-8", errors="ignore")
    hits = context_hits(text, scan_needles, limit=MAX_HITS_PER_FILE)
    if hits:
        report["text_and_binary_hits"].append({
            "path": str(path),
            "bytes": size,
            "sha256": sha256(path),
            "hits": hits,
        })

    for match in url_re.finditer(text):
        url = match.group(0).rstrip(".,);]}>")
        if url not in url_seen:
            url_seen.add(url)
            report["urls"].append({"url": url, "path": str(path), "offset": match.start()})

    # Some Android/Flutter strings are UTF-16LE. Scan only when it can add evidence.
    if b"\x00" in data:
        utf16 = data.decode("utf-16le", errors="ignore")
        utf16_hits = context_hits(utf16, scan_needles, limit=MAX_HITS_PER_FILE)
        if utf16_hits:
            report["text_and_binary_hits"].append({
                "path": str(path),
                "bytes": size,
                "encoding": "utf-16le",
                "sha256": sha256(path),
                "hits": utf16_hits,
            })
        for match in url_re.finditer(utf16):
            url = match.group(0).rstrip(".,);]}>")
            if url not in url_seen:
                url_seen.add(url)
                report["urls"].append({"url": url, "path": str(path), "offset": match.start(), "encoding": "utf-16le"})

report["urls"].sort(key=lambda x: (x["url"], x["path"]))

json_path = OUT / "enikk-favorite-audit-v3477.json"
json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), "utf-8")

# Human-readable index.  It deliberately points back to exact JSON evidence instead of interpreting IDs.
lines = [
    "# ENIKK favorite-item audit for V34.7.7",
    "",
    "> Evidence-only extraction. No TID, phase, or skill value is inferred or filled in.",
    "",
    f"- APK: `{report['provenance'].get('apk', {}).get('sha256', 'missing')}`",
    f"- Extracted files: **{report['inventory']['file_count']}**",
    f"- SQLite payloads: **{len(report['sqlite'])}**",
    f"- App `favoriteItemPhase` exact occurrences: **{report.get('app', {}).get('favoriteItemPhase_exact_count', 0)}**",
    f"- App/source context hits: **{len(report.get('app', {}).get('hits', []))}**",
    f"- ENIKK text/binary hit groups: **{len(report['text_and_binary_hits'])}**",
    f"- Distinct URLs: **{len(report['urls'])}**",
    "",
    "## SQLite payloads",
]
for db in report["sqlite"]:
    relevant = [t for t in db.get("tables", []) if t.get("schema_relevant") or t.get("matched_rows")]
    lines.append(f"- `{db['path']}` — {len(db.get('tables', []))} tables; {len(relevant)} relevant/matched")
    for table in relevant[:120]:
        lines.append(
            f"  - `{table['name']}` rows={table['row_count']} columns={table['columns']} "
            f"matched={len(table.get('matched_rows', []))}"
        )

lines.extend(["", "## Target/source hit groups"])
for group in report["text_and_binary_hits"][:260]:
    needles = sorted({h["needle"] for h in group.get("hits", [])})
    lines.append(f"- `{group['path']}` — {', '.join(needles)}")

lines.extend(["", "## ENIKK/API URL candidates"])
for item in report["urls"][:500]:
    low = item["url"].casefold()
    if any(x in low for x in ("enikk", "nikke", "api", "master", "data", "skill", "favorite")):
        lines.append(f"- `{item['url']}` — `{item['path']}`")

if report["warnings"]:
    lines.extend(["", "## Warnings"])
    lines.extend(f"- {w}" for w in report["warnings"])

lines.extend([
    "",
    "## Full evidence",
    "See `audit/enikk-favorite-audit-v3477.json` for exact schemas, rows, offsets, and source snippets.",
])
(OUT / "enikk-favorite-audit-v3477.md").write_text("\n".join(lines) + "\n", "utf-8")

print(json.dumps({
    "json": str(json_path),
    "apk_sha256": report.get("provenance", {}).get("apk", {}).get("sha256"),
    "sqlite_payloads": len(report["sqlite"]),
    "app_hits": len(report.get("app", {}).get("hits", [])),
    "source_hit_groups": len(report["text_and_binary_hits"]),
    "urls": len(report["urls"]),
}, ensure_ascii=False, indent=2))
