"""Classify post-delivery human commits as corrective vs non-corrective. Stdlib only.

The §7 gold signal is the human-diff — but only its *corrective* part. A post-delivery
commit that modifies or deletes lines the mission authored is correction-shaped (a defect
signal against the mission); a commit that only adds new lines or touches lines the mission
never wrote is continuation/housekeeping (no signal). Conflating the two cost an email
round-trip on block-hygiene-20260608 (a branch-recovery docs commit read as a possible
correction). This script makes the distinction a [machine] fact:

  python diff_overlap.py <repo> <fork_point> <delivered_ref> [head_ref]

Mission-authored lines = lines introduced by commits in fork_point..delivered_ref.
For every commit in delivered_ref..head_ref it counts how many of the lines that commit
modified/deleted were mission-authored (git blame at the commit's parent). Output is JSON:
per-commit overlap counts + a classification hint. The hint is presented to the Human for
confirm-or-override (/mission-log-audit) — the machine stat is evidence, the Human stays
the truth source.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

_HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@")


def _git(repo: str, *args: str) -> str:
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args[:3])}... failed: {r.stderr.strip()[:300]}")
    return r.stdout


def _removed_ranges(repo: str, commit: str) -> dict[str, list[tuple[int, int]]]:
    """Per pre-image file path: (start, count) ranges of lines this commit removed/modified."""
    out = _git(repo, "diff", "-U0", "--no-color", f"{commit}^", commit)
    ranges: dict[str, list[tuple[int, int]]] = {}
    path = None
    for line in out.splitlines():
        if line.startswith("--- "):
            p = line[4:].strip()
            path = None if p == "/dev/null" else p[2:] if p.startswith("a/") else p
        elif line.startswith("Binary files"):
            path = None
        elif path is not None:
            m = _HUNK.match(line)
            if m:
                start, count = int(m.group(1)), int(m.group(2) or "1")
                if count > 0:
                    ranges.setdefault(path, []).append((start, count))
    return ranges


def _blame_authors(repo: str, commit: str, path: str,
                   ranges: list[tuple[int, int]]) -> list[str]:
    """SHA that authored each removed line, blamed at the pre-image <commit>^."""
    args = ["blame", "--line-porcelain"]
    for start, count in ranges:
        args += ["-L", f"{start},{start + count - 1}"]
    args += [f"{commit}^", "--", path]
    try:
        out = _git(repo, *args)
    except SystemExit:
        return []  # path absent at parent (rename/creation edge) — no attribution possible
    return [ln.split()[0] for ln in out.splitlines()
            if ln and not ln.startswith("\t") and re.match(r"^[0-9a-f]{40} ", ln)]


def analyze(repo: str, fork: str, delivered: str, head: str = "HEAD") -> dict:
    mission = set(_git(repo, "rev-list", f"{fork}..{delivered}").split())
    human = _git(repo, "rev-list", "--no-merges", "--reverse",
                 f"{delivered}..{head}").split()
    commits = []
    for sha in human:
        subject = _git(repo, "log", "-1", "--format=%s", sha).strip()
        removed = _removed_ranges(repo, sha)
        touched = overlap = 0
        files_hit: list[str] = []
        for path, ranges in removed.items():
            authors = _blame_authors(repo, sha, path, ranges)
            touched += len(authors)
            hits = sum(1 for a in authors if a in mission)
            overlap += hits
            if hits:
                files_hit.append(path)
        commits.append({
            "sha": sha[:10], "subject": subject,
            "lines_removed_or_modified": touched,
            "mission_authored_lines": overlap,
            "files_with_overlap": files_hit,
            "hint": "correction" if overlap else "non-corrective",
        })
    total = sum(c["mission_authored_lines"] for c in commits)
    return {
        "repo": repo, "fork_point": fork, "delivered_ref": delivered, "head_ref": head,
        "mission_commits": len(mission), "post_delivery_commits": len(commits),
        "total_mission_lines_touched": total,
        "classification_hint": ("correction" if total else
                                "non-corrective" if commits else "none"),
        "commits": commits,
        "note": "hint only — the Human confirms or overrides (§2.2 truth-source asymmetry)",
    }


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit(__doc__.strip().split("\n\n")[1])
    print(json.dumps(analyze(*sys.argv[1:5]), indent=2))


if __name__ == "__main__":
    main()
