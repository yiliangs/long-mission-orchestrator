from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_record


class SchemaTests(unittest.TestCase):
    def assert_valid(self, schema_name: str, document: dict) -> None:
        schema = json.loads((ROOT / "schema" / schema_name).read_text(encoding="utf-8"))
        errors: list[str] = []
        validate_record.check(document, schema, schema, "", errors)
        self.assertEqual([], errors)

    def test_reviewed_plan_with_governance_is_valid(self) -> None:
        digest = "a" * 64
        self.assert_valid(
            "mission-plan.schema.json",
            {
                "schema_version": "1.0",
                "run_id": "reviewed-plan",
                "goal": "Exercise reviewed closure",
                "repo": "C:/repo",
                "mode": "attended",
                "branch": "agent/mission-reviewed-plan",
                "governance": {
                    "runtime_version": "1.0.1",
                    "constitution_sha256": digest,
                    "contract_sha256": digest,
                    "executor_sha256": digest,
                },
                "boundaries": [],
                "acceptance_criteria": ["The reviewed claim holds."],
                "nodes": [
                    {
                        "id": "n1",
                        "title": "Review architecture",
                        "instruction": "Create and review the artifact.",
                        "deps": [],
                        "parallelizable": False,
                        "write_set": ["artifact.md"],
                        "acceptance_criteria": ["The architecture is coherent."],
                        "witness": {
                            "claim": "The architecture is coherent.",
                            "kind": "reviewed",
                            "method": "Fresh artifact-only review.",
                        },
                    }
                ],
            },
        )

    def test_persisted_audit_is_valid(self) -> None:
        digest = "b" * 64
        self.assert_valid(
            "mission-audit.schema.json",
            {
                "schema_version": "1.0",
                "run_id": "audit-run",
                "sequence": 1,
                "repair_cycles": 0,
                "audited_commit": "abcdef1",
                "runtime_version": "1.0.1",
                "governance": {
                    "constitution_sha256": digest,
                    "contract_sha256": digest,
                    "executor_sha256": digest,
                },
                "audit": {
                    "status": "failed",
                    "findings": [
                        {
                            "locus": "artifact.md:1",
                            "criterion": "Artifact is correct.",
                            "evidence": "The value is wrong.",
                            "consequence": "The criterion fails.",
                            "recommendation": "Correct the value.",
                        }
                    ],
                    "human_deferred": [],
                    "summary": "One defect remains.",
                },
            },
        )

    def test_in_flight_repair_checkpoint_is_valid(self) -> None:
        self.assert_valid(
            "mission-repair.schema.json",
            {
                "schema_version": "1.0",
                "run_id": "audit-run",
                "repair_cycles": 1,
                "source_audit_sequence": 1,
            },
        )

    def test_terminal_failed_result_is_valid(self) -> None:
        self.assert_valid(
            "mission-result.schema.json",
            {
                "schema_version": "1.0",
                "run_id": "audit-run",
                "status": "failed",
                "success": False,
                "audit_sequence": 3,
                "audited_commit": "abcdef1",
                "audit_file": ".mission/audit-run/audits/003.json",
                "repair_cycles": 2,
                "findings": [],
                "human_deferred": [],
                "summary": "Mission stopped after bounded repair.",
                "terminal_at": "2026-07-25T00:00:00+00:00",
            },
        )


if __name__ == "__main__":
    unittest.main()
