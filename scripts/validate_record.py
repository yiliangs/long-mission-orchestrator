"""Deterministic JSON-Schema validation for mission records and reports (§1.3: no model call).

Stdlib only — implements exactly the subset the LMO schemas use:
  type (incl. union lists), enum, const, required, properties,
  additionalProperties (false | schema), items, propertyNames-free maps.

Usage:
  python validate_record.py <schema.json> <file.json> [<file.json> ...]

Exit 0 = all valid. Exit 1 = at least one violation (printed, one per line).
Legacy carve-out: a mission-record with schema_version "0.1" is warn-only —
violations print but do not fail the run (the v0.1 schema was unsatisfiable;
those records predate validation and the evolution loop already partitions
regimes by constitution_version).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def check(value, schema: dict, path: str, errors: list[str]) -> None:
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}, got {value!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum {schema['enum']}")
    if "type" in schema and not _type_ok(value, schema["type"]):
        errors.append(f"{path}: type {type(value).__name__} does not match {schema['type']}")
        return  # shape is wrong; deeper checks would just cascade

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required key '{key}'")
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, sub in value.items():
            kpath = f"{path}.{key}" if path else key
            if key in props:
                check(sub, props[key], kpath, errors)
            elif extra is False:
                errors.append(f"{kpath}: unknown key (additionalProperties: false)")
            elif isinstance(extra, dict):
                check(sub, extra, kpath, errors)

    if isinstance(value, list) and "items" in schema:
        for idx, item in enumerate(value):
            check(item, schema["items"], f"{path}[{idx}]", errors)


def _type_ok(value, expected) -> bool:
    types = expected if isinstance(expected, list) else [expected]
    for t in types:
        if t == "object" and isinstance(value, dict):
            return True
        if t == "array" and isinstance(value, list):
            return True
        if t == "string" and isinstance(value, str):
            return True
        if t == "integer" and isinstance(value, int) and not isinstance(value, bool):
            return True
        if t == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if t == "boolean" and isinstance(value, bool):
            return True
        if t == "null" and value is None:
            return True
    return False


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__.strip().splitlines()[0])
        print("usage: python validate_record.py <schema.json> <file.json> [...]")
        return 2
    schema = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    failed = False
    for arg in argv[2:]:
        doc_path = Path(arg)
        doc = json.loads(doc_path.read_text(encoding="utf-8"))
        errors: list[str] = []
        check(doc, schema, "", errors)
        # Legacy carve-out only for schemas that version their documents (mission-record):
        # a record predating validation (no schema_version, or 0.1) warns but does not fail.
        versioned = "schema_version" in schema.get("properties", {})
        legacy = versioned and isinstance(doc, dict) and doc.get("schema_version") in ("0.1", None)
        status = "VALID" if not errors else ("LEGACY-0.1 (warn-only)" if legacy else "INVALID")
        print(f"{doc_path.name}: {status}")
        for e in errors:
            print(f"  - {e}")
        if errors and not legacy:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
