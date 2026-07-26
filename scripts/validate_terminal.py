"""Validate a committed terminal mission state before recovery disarms."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import validate_record


def _schema_path(name: str) -> Path:
    root = Path(__file__).resolve().parent.parent
    repository = root / "schema" / name
    return repository if repository.is_file() else root / "docs" / name


def _validate(document: dict, schema_name: str, label: str, errors: list[str]) -> None:
    schema = json.loads(_schema_path(schema_name).read_text(encoding="utf-8"))
    validate_record.check(document, schema, schema, label, errors)


def _within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate(run_dir: Path) -> list[str]:
    errors: list[str] = []
    run_dir = run_dir.resolve()
    result_path = run_dir / "result.json"
    report_path = run_dir / "REPORT.md"
    latest_audit_path = run_dir / "audit.json"
    for required in (result_path, report_path, latest_audit_path):
        if not required.is_file():
            errors.append(f"missing required terminal artifact: {required.name}")
    if errors:
        return errors

    try:
        result = json.loads(result_path.read_text(encoding="utf-8"))
        audit_record = json.loads(latest_audit_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"terminal JSON is unreadable: {error}"]

    _validate(result, "mission-result.schema.json", "result", errors)
    _validate(audit_record, "mission-audit.schema.json", "audit", errors)
    if errors:
        return errors

    audit_file = Path(result["audit_file"])
    if not audit_file.is_absolute():
        audit_file = (run_dir.parent.parent / audit_file).resolve()
    if not _within(audit_file, run_dir / "audits"):
        errors.append("result.audit_file must identify a numbered audit inside the run directory")
    elif not audit_file.is_file():
        errors.append("result.audit_file does not exist")
    elif audit_file.read_bytes() != latest_audit_path.read_bytes():
        errors.append("audit.json is not byte-identical to the numbered canonical audit")

    audit = audit_record["audit"]
    expected_success = result["status"] == "passed"
    comparisons = {
        "status": (result["status"], audit["status"]),
        "audit_sequence": (result["audit_sequence"], audit_record["sequence"]),
        "repair_cycles": (result["repair_cycles"], audit_record["repair_cycles"]),
        "audited_commit": (result["audited_commit"], audit_record["audited_commit"]),
        "findings": (result["findings"], audit["findings"]),
        "human_deferred": (result["human_deferred"], audit["human_deferred"]),
        "summary": (result["summary"], audit["summary"]),
        "success": (result["success"], expected_success),
    }
    for field, (actual, expected) in comparisons.items():
        if actual != expected:
            errors.append(f"result.{field} contradicts the canonical audit")

    success_path = run_dir / "mission.success"
    if success_path.exists() != expected_success:
        errors.append("mission.success presence does not match passed status")
    if not report_path.read_text(encoding="utf-8").strip():
        errors.append("REPORT.md is empty")

    repo = run_dir.parent.parent
    tracked = [result_path, report_path, latest_audit_path]
    if audit_file.is_file():
        tracked.append(audit_file)
    if success_path.exists():
        tracked.append(success_path)
    relative = [str(path.relative_to(repo)) for path in tracked if _within(path, repo)]
    if len(relative) != len(tracked):
        errors.append("terminal artifacts are not all inside the repository")
        return errors

    listed = subprocess.run(
        ["git", "-C", str(repo), "ls-files", "--error-unmatch", "--", *relative],
        capture_output=True,
        text=True,
    )
    if listed.returncode != 0:
        errors.append("terminal artifacts are not all committed Git paths")
    dirty = subprocess.run(
        ["git", "-C", str(repo), "status", "--porcelain", "--", *relative],
        capture_output=True,
        text=True,
    )
    if dirty.returncode != 0 or dirty.stdout.strip():
        errors.append("terminal artifacts differ from the committed HEAD")
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python validate_terminal.py <run-dir>")
        return 2
    errors = validate(Path(argv[1]))
    if errors:
        print("INVALID terminal mission state")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("VALID terminal mission state")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
