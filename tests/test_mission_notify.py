from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import mission_notify


class MissionNotifyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.run_dir = Path(self.temporary.name)
        (self.run_dir / "result.json").write_text(
            json.dumps({"run_id": "test-run", "status": "failed"}), encoding="utf-8"
        )
        (self.run_dir / "REPORT.md").write_text("# Mission failed\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_send_is_idempotent(self) -> None:
        calls: list[tuple[str, str, str]] = []

        def sender(subject: str, body: str, run_id: str) -> tuple[str, str]:
            calls.append((subject, body, run_id))
            return "owner@example.com", "<message@example.com>"

        first_code, first = mission_notify.notify(self.run_dir, sender)
        second_code, second = mission_notify.notify(self.run_dir, sender)

        self.assertEqual(mission_notify.SENT, first_code)
        self.assertEqual(mission_notify.SENT, second_code)
        self.assertEqual("sent", first["status"])
        self.assertEqual(first, second)
        self.assertEqual(1, len(calls))

    def test_ambiguous_send_is_not_replayed_after_report_changes(self) -> None:
        calls = 0

        def sender(_subject: str, _body: str, _run_id: str) -> tuple[str, str]:
            nonlocal calls
            calls += 1
            raise OSError("transport outcome unknown")

        first_code, first = mission_notify.notify(self.run_dir, sender)
        (self.run_dir / "REPORT.md").write_text("# Corrected mission failure\n", encoding="utf-8")
        second_code, second = mission_notify.notify(self.run_dir, sender)

        self.assertEqual(mission_notify.AMBIGUOUS, first_code)
        self.assertEqual(mission_notify.RECONCILIATION_REQUIRED, second_code)
        self.assertEqual("ambiguous", first["status"])
        self.assertEqual(first, second)
        self.assertEqual(1, calls)

    def test_sent_run_never_sends_again_after_report_changes(self) -> None:
        calls = 0

        def sender(_subject: str, _body: str, _run_id: str) -> tuple[str, str]:
            nonlocal calls
            calls += 1
            return "owner@example.com", f"<message-{calls}@example.com>"

        mission_notify.notify(self.run_dir, sender)
        (self.run_dir / "REPORT.md").write_text("# Corrected mission report\n", encoding="utf-8")
        code, state = mission_notify.notify(self.run_dir, sender)

        self.assertEqual(mission_notify.SENT, code)
        self.assertEqual("sent", state["status"])
        self.assertEqual(1, calls)

    def test_concurrent_attempts_send_once(self) -> None:
        entered = threading.Event()
        release = threading.Event()
        first_result: list[tuple[int, dict]] = []
        calls = 0

        def sender(_subject: str, _body: str, _run_id: str) -> tuple[str, str]:
            nonlocal calls
            calls += 1
            entered.set()
            release.wait(timeout=5)
            return "owner@example.com", "<message@example.com>"

        thread = threading.Thread(target=lambda: first_result.append(mission_notify.notify(self.run_dir, sender)))
        thread.start()
        self.assertTrue(entered.wait(timeout=5))
        second_code, second = mission_notify.notify(self.run_dir, sender)
        release.set()
        thread.join(timeout=5)

        self.assertEqual(mission_notify.RECONCILIATION_REQUIRED, second_code)
        self.assertEqual("busy", second["status"])
        self.assertEqual(mission_notify.SENT, first_result[0][0])
        self.assertEqual(1, calls)


if __name__ == "__main__":
    unittest.main()
