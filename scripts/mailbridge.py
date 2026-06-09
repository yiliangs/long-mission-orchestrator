"""Domain-agnostic two-way email transport for the orchestrator's §12 channel.

This is the *proven plaid-finance channel* (constitution §12) extracted standalone — no
dependency on plaid's db/config, stdlib only — so the mission skills can email REPORT.md /
decision walk-throughs / evolution proposals outbound, and the Human's reply can be
authenticated and routed inbound.

Outbound: ``send()`` mints + records a Message-ID (idstring ``lmomission``) so a reply can be
proven a genuine reply. Inbound: ``poll(handler)`` scans a recent INBOX window and calls
``handler(ctx)`` for every reply that clears the triple gate:
  1. From == REPORT_TO/COMMAND_FROM,
  2. ``Authentication-Results`` shows dmarc/dkim pass (defeats a forged From),
  3. the reply cites a Message-ID *this channel* issued — which, because each channel keeps its
     own state store, also routes LMO vs. plaid-finance replies that share one bot inbox.

Config: ``~/.claude/mailbridge.env`` (KEY=VALUE, gitignored). State: ``~/.claude/mailbridge.sqlite``.
Both are machine-local — secrets and Message-IDs never enter a synced repo.
"""
from __future__ import annotations

import email
import email.utils
import imaplib
import re
import smtplib
import sqlite3
from datetime import date, timedelta
from email.header import decode_header, make_header
from email.message import EmailMessage, Message
from email.utils import make_msgid
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude"
CONFIG_PATH = CLAUDE_DIR / "mailbridge.env"
STATE_PATH = CLAUDE_DIR / "mailbridge.sqlite"
LOOKBACK_DAYS = 7
ID_STRING = "lmomission"          # tags issued ids; also partitions LMO vs. plaid in a shared inbox

_QUOTE_START = re.compile(
    r"^\s*(On .+wrote:\s*$|-{2,}\s*Original Message|_{5,}|From:\s)", re.IGNORECASE)
_config_cache: dict[str, str] | None = None


# --- config ------------------------------------------------------------------

def config() -> dict[str, str]:
    """Parse ~/.claude/mailbridge.env once (a minimal KEY=VALUE reader, no deps)."""
    global _config_cache
    if _config_cache is None:
        cfg: dict[str, str] = {}
        if CONFIG_PATH.exists():
            for line in CONFIG_PATH.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                cfg[key.strip()] = val.strip().strip('"').strip("'")
        _config_cache = cfg
    return _config_cache


def _require(key: str) -> str:
    val = config().get(key)
    if not val:
        raise SystemExit(f"Set {key} in {CONFIG_PATH} (see mailbridge.env.example).")
    return val


# --- state store -------------------------------------------------------------

def _db() -> sqlite3.Connection:
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(STATE_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """CREATE TABLE IF NOT EXISTS issued_messages (
               message_id TEXT PRIMARY KEY,
               kind       TEXT,            -- report | walkthrough | proposal | ack
               ref        TEXT,            -- the run-id / proposal-id the thread is about
               issued_at  TEXT NOT NULL DEFAULT (datetime('now')));
           CREATE TABLE IF NOT EXISTS processed_commands (
               message_id   TEXT PRIMARY KEY,
               processed_at TEXT NOT NULL DEFAULT (datetime('now')));""")
    return conn


# --- outbound ----------------------------------------------------------------

def send(subject: str, text_body: str, html_body: str | None = None, *,
         to: str | None = None, in_reply_to: str | None = None,
         kind: str | None = None, ref: str | None = None) -> tuple[str, str]:
    """Send a mail from the bot account; mint + record a Message-ID for the reply gate.

    Returns (recipient, message_id). ``kind``/``ref`` are recorded so an inbound reply that
    cites this id resolves straight to the mission/proposal it concerns.
    """
    user, password = _require("SMTP_USER"), _require("SMTP_APP_PASSWORD")
    recipient = to or config().get("REPORT_TO") or user
    message_id = make_msgid(idstring=ID_STRING)
    msg = EmailMessage()
    msg["Message-ID"] = message_id
    msg["Subject"], msg["From"], msg["To"] = subject, user, recipient
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP_SSL(config().get("SMTP_HOST", "smtp.gmail.com"),
                          int(config().get("SMTP_PORT", "465"))) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)
    conn = _db()
    conn.execute("INSERT OR IGNORE INTO issued_messages (message_id, kind, ref) VALUES (?, ?, ?)",
                 (message_id, kind, ref))
    conn.commit()
    conn.close()
    return recipient, message_id


# --- inbound -----------------------------------------------------------------

def poll(handler) -> int:
    """Scan a LOOKBACK_DAYS INBOX window; call ``handler(ctx)`` for each authorized reply.

    ``handler`` returns True once it has handled the reply (then it's recorded so it never
    runs twice). Dedup is on processed_commands, not IMAP \\Seen, so a read reply still runs.
    """
    user, password = _require("SMTP_USER"), _require("SMTP_APP_PASSWORD")
    allowed_from = (config().get("COMMAND_FROM") or config().get("REPORT_TO") or user).lower()
    conn = _db()
    handled = 0
    imap = imaplib.IMAP4_SSL(config().get("IMAP_HOST", "imap.gmail.com"),
                             int(config().get("IMAP_PORT", "993")))
    try:
        imap.login(user, password)
        imap.select("INBOX")
        since = (date.today() - timedelta(days=LOOKBACK_DAYS)).strftime("%d-%b-%Y")
        _typ, data = imap.search(None, "SINCE", since)
        for num in (data[0] or b"").split():
            try:
                _typ, raw = imap.fetch(num, "(RFC822)")
                msg = email.message_from_bytes(raw[0][1])
                msg_id = (msg.get("Message-ID") or "").strip()
                if msg_id and _is_processed(conn, msg_id):
                    continue
                issue = _referenced_issue(conn, msg)        # None unless it cites OUR issued id
                ok, reason = _authorize(msg, allowed_from, issue)
                if not ok:
                    _log(f"skip {msg_id or '(no id)'}: {reason}")
                    continue
                ctx = _reply_context(msg, issue)
                if handler(ctx) and msg_id:
                    conn.execute("INSERT OR IGNORE INTO processed_commands (message_id) VALUES (?)",
                                 (msg_id,))
                    conn.commit()
                    handled += 1
            except Exception as e:                          # one bad message shouldn't abort the batch
                _log(f"error on message {num!r}: {type(e).__name__}: {e}")
            finally:
                try:
                    imap.store(num, "+FLAGS", "\\Seen")     # tidy; correctness is processed_commands
                except Exception:
                    pass
    finally:
        try:
            imap.logout()
        finally:
            conn.close()
    return handled


# --- trust gate --------------------------------------------------------------

def _authorize(msg: Message, allowed_from: str, issue) -> tuple[bool, str]:
    sender = _sender_address(msg)
    if sender != allowed_from:
        return False, f"sender {sender!r} != allowed {allowed_from!r}"
    if not _auth_results_pass(msg):
        return False, "Authentication-Results did not show dmarc/dkim pass"
    if _require_issued() and issue is None:
        return False, "not a reply to an LMO-issued message"
    return True, "ok"


def _auth_results_pass(msg: Message) -> bool:
    headers = " ".join(msg.get_all("Authentication-Results") or []).lower()
    return bool(headers) and ("dmarc=pass" in headers or "dkim=pass" in headers)


def _referenced_issue(conn, msg: Message):
    """The issued_messages row this reply threads onto, or None — also the LMO/plaid router."""
    refs = " ".join(v for v in (msg.get("In-Reply-To"), msg.get("References")) if v)
    for mid in re.findall(r"<[^>]+>", refs):
        row = conn.execute(
            "SELECT message_id, kind, ref FROM issued_messages WHERE message_id=?", (mid,)
        ).fetchone()
        if row:
            return row
    return None


def _require_issued() -> bool:
    return config().get("INBOX_REQUIRE_ISSUED", "1").strip().lower() not in ("0", "false", "no")


def _is_processed(conn, message_id: str) -> bool:
    return conn.execute("SELECT 1 FROM processed_commands WHERE message_id=?",
                        (message_id,)).fetchone() is not None


# --- message parsing ---------------------------------------------------------

def _reply_context(msg: Message, issue) -> dict:
    return {
        "command": _extract_command(msg),
        "subject": _decode_header(msg.get("Subject", "")),
        "reply_subject": _reply_subject(msg),
        "message_id": (msg.get("Message-ID") or "").strip(),
        "sender": _sender_address(msg),
        "kind": issue["kind"] if issue else None,
        "ref": issue["ref"] if issue else None,
    }


def _sender_address(msg: Message) -> str:
    return email.utils.parseaddr(msg.get("From", ""))[1].lower()


def _decode_header(raw: str) -> str:
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw or ""


def _reply_subject(msg: Message) -> str:
    subject = " ".join(_decode_header(msg.get("Subject", "")).split()) or "(no subject)"
    return subject if subject.lower().startswith("re:") else "Re: " + subject


def _extract_command(msg: Message) -> str:
    lines = []
    for line in _plain_text(msg).splitlines():
        if line.lstrip().startswith(">"):
            continue
        if _QUOTE_START.match(line):
            break
        lines.append(line)
    return "\n".join(lines).strip()


def _plain_text(msg: Message) -> str:
    if msg.is_multipart():
        parts = list(msg.walk())
        for part in parts:
            if part.get_content_type() == "text/plain" and \
                    "attachment" not in str(part.get("Content-Disposition", "")):
                return _decode(part)
        for part in parts:
            if part.get_content_type().startswith("text/"):
                return _decode(part)
        return ""
    return _decode(msg)


def _decode(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return part.get_payload() if isinstance(part.get_payload(), str) else ""
    return payload.decode(part.get_content_charset() or "utf-8", errors="replace")


def _log(message: str) -> None:
    print(f"[mailbridge] {message}")
