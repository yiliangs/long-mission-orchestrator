"""Send at most one terminal mission report through the shared Claude Channel."""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import os
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator


SENT = 0
INVALID = 2
AMBIGUOUS = 23
RECONCILIATION_REQUIRED = 24


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _digest(result_path: Path, report_path: Path) -> str:
    value = result_path.read_bytes() + b"\0" + report_path.read_bytes()
    return hashlib.sha256(value).hexdigest()


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def _run_lock(path: Path) -> Iterator[bool]:
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        yield False
        return
    try:
        with os.fdopen(descriptor, "w", encoding="ascii") as stream:
            stream.write(f"pid={os.getpid()} created={_now()}\n")
            stream.flush()
            os.fsync(stream.fileno())
        yield True
    finally:
        path.unlink(missing_ok=True)


def _channel_sender(subject: str, body: str, run_id: str) -> tuple[str, str]:
    scripts = Path.home() / ".claude" / "scripts"
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    channelbridge = importlib.import_module("channelbridge")
    return channelbridge.send("lmo", subject, body, kind="mission-result", ref=run_id)


def notify(run_dir: Path, sender: Callable[[str, str, str], tuple[str, str]] = _channel_sender) -> tuple[int, dict]:
    result_path = run_dir / "result.json"
    report_path = run_dir / "REPORT.md"
    state_path = run_dir / "notification.json"
    lock_path = run_dir / "notification.lock"
    if not result_path.is_file() or not report_path.is_file():
        return INVALID, {"status": "invalid", "error": "result.json and REPORT.md are required"}

    with _run_lock(lock_path) as acquired:
        if not acquired:
            return RECONCILIATION_REQUIRED, {
                "status": "busy",
                "run_id": run_dir.name,
                "error": "another terminal notification attempt owns notification.lock",
            }

        result = _read_json(result_path)
        run_id = str(result.get("run_id") or run_dir.name)
        status = str(result.get("status") or "unknown")
        report = report_path.read_text(encoding="utf-8")
        digest = _digest(result_path, report_path)
        previous = _read_json(state_path) if state_path.is_file() else None

        if previous:
            if previous.get("status") == "sent":
                return SENT, previous
            if previous.get("status") in {"prepared", "ambiguous"}:
                return RECONCILIATION_REQUIRED, previous

        prepared = {
            "schema_version": "1.0",
            "run_id": run_id,
            "status": "prepared",
            "digest": digest,
            "prepared_at": _now(),
        }
        _write_json_atomic(state_path, prepared)

        subject = f"mission {run_id}: {status}"
        try:
            recipient, message_id = sender(subject, report, run_id)
        except Exception as error:
            ambiguous = {
                **prepared,
                "status": "ambiguous",
                "failed_at": _now(),
                "error": f"{type(error).__name__}: {error}",
            }
            _write_json_atomic(state_path, ambiguous)
            return AMBIGUOUS, ambiguous

        sent = {
            **prepared,
            "status": "sent",
            "sent_at": _now(),
            "recipient": recipient,
            "message_id": message_id,
        }
        _write_json_atomic(state_path, sent)
        return SENT, sent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args(argv)
    code, state = notify(Path(args.run_dir).resolve())
    print(json.dumps(state, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
