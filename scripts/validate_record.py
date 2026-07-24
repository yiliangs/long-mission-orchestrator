"""Deterministic validation for the JSON-Schema subset used by LMO.

Stdlib only. Supported keywords: local $ref, type, enum, const, required,
properties, additionalProperties, items, minItems, maxItems, minLength,
maxLength, pattern, minimum, and maximum.

Usage:
  python validate_record.py <schema.json> <file.json> [<file.json> ...]

Exit 0 means all documents are valid. Exit 1 means at least one violation.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def check(value, schema: dict, root: dict, path: str, errors: list[str]) -> None:
    if "$ref" in schema:
        schema = _resolve_ref(root, schema["$ref"])

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}, got {value!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum {schema['enum']}")
    if "type" in schema and not _type_ok(value, schema["type"]):
        errors.append(f"{path}: type {type(value).__name__} does not match {schema['type']}")
        return

    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: string shorter than minLength {schema['minLength']}")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}: string longer than maxLength {schema['maxLength']}")
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            errors.append(f"{path}: {value!r} does not match pattern {schema['pattern']!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} is below minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} is above maximum {schema['maximum']}")

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required key '{key}'")
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, sub in value.items():
            kpath = f"{path}.{key}" if path else key
            if key in props:
                check(sub, props[key], root, kpath, errors)
            elif extra is False:
                errors.append(f"{kpath}: unknown key (additionalProperties: false)")
            elif isinstance(extra, dict):
                check(sub, extra, root, kpath, errors)

    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: array shorter than minItems {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: array longer than maxItems {schema['maxItems']}")
        if "items" in schema:
            for index, item in enumerate(value):
                check(item, schema["items"], root, f"{path}[{index}]", errors)


def _resolve_ref(root: dict, reference: str) -> dict:
    if not reference.startswith("#/"):
        raise ValueError(f"unsupported external $ref: {reference}")
    target = root
    for raw_part in reference[2:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        target = target[part]
    return target


def _type_ok(value, expected) -> bool:
    types = expected if isinstance(expected, list) else [expected]
    for schema_type in types:
        if schema_type == "object" and isinstance(value, dict):
            return True
        if schema_type == "array" and isinstance(value, list):
            return True
        if schema_type == "string" and isinstance(value, str):
            return True
        if schema_type == "integer" and isinstance(value, int) and not isinstance(value, bool):
            return True
        if schema_type == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if schema_type == "boolean" and isinstance(value, bool):
            return True
        if schema_type == "null" and value is None:
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
        check(doc, schema, schema, "", errors)
        print(f"{doc_path.name}: {'VALID' if not errors else 'INVALID'}")
        for error in errors:
            print(f"  - {error}")
        if errors:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
