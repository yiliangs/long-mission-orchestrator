from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import validate_terminal


class TerminalValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name)
        self.run_dir = self.repo / ".mission" / "terminal-run"
        audits = self.run_dir / "audits"
        audits.mkdir(parents=True)
        finding = {
            "locus": "artifact.txt:1",
            "criterion": "Artifact must be correct.",
            "evidence": "The value is wrong.",
            "consequence": "The criterion fails.",
            "recommendation": "Correct the value.",
        }
        audit = {
            "schema_version": "1.0",
            "run_id": "terminal-run",
            "sequence": 1,
            "repair_cycles": 0,
            "audited_commit": "abcdef1",
            "runtime_version": "1.0.1",
            "governance": {
                "constitution_sha256": "a" * 64,
                "contract_sha256": "b" * 64,
                "executor_sha256": "c" * 64,
            },
            "audit": {
                "status": "failed",
                "findings": [finding],
                "human_deferred": [],
                "summary": "One defect remains.",
            },
        }
        result = {
            "schema_version": "1.0",
            "run_id": "terminal-run",
            "status": "failed",
            "success": False,
            "audit_sequence": 1,
            "audited_commit": "abcdef1",
            "audit_file": ".mission/terminal-run/audits/001.json",
            "repair_cycles": 0,
            "findings": [finding],
            "human_deferred": [],
            "summary": "One defect remains.",
            "terminal_at": "2026-07-25T00:00:00+00:00",
        }
        payload = json.dumps(audit, indent=2) + "\n"
        (audits / "001.json").write_text(payload, encoding="utf-8")
        (self.run_dir / "audit.json").write_text(payload, encoding="utf-8")
        (self.run_dir / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        (self.run_dir / "REPORT.md").write_text("# Mission failed\n", encoding="utf-8")
        subprocess.run(["git", "init", "-b", "test"], cwd=self.repo, check=True, capture_output=True)
        subprocess.run(["git", "add", "."], cwd=self.repo, check=True)
        subprocess.run(["git", "commit", "-m", "Add terminal state"], cwd=self.repo, check=True, capture_output=True)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_valid_committed_failed_terminal_state(self) -> None:
        self.assertEqual([], validate_terminal.validate(self.run_dir))

    def test_contradictory_success_is_rejected(self) -> None:
        path = self.run_dir / "result.json"
        result = json.loads(path.read_text(encoding="utf-8"))
        result["success"] = True
        path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        errors = validate_terminal.validate(self.run_dir)
        self.assertIn("result.success contradicts the canonical audit", errors)
        self.assertIn("terminal artifacts differ from the committed HEAD", errors)

    def test_partial_known_status_does_not_validate(self) -> None:
        (self.run_dir / "result.json").write_text('{"status":"failed"}\n', encoding="utf-8")
        errors = validate_terminal.validate(self.run_dir)
        self.assertTrue(any("missing required key" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
