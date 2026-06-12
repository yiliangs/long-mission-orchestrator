"""Markdown -> email-safe HTML, stdlib only.

The §12 channel mails REPORT.md / walk-throughs / proposals. Mail clients render the
text/html alternative; this module produces it. Constraints that shaped it:
  - inline CSS only (Gmail/Outlook strip <style> blocks unpredictably),
  - no pip deps (runs on any machine the heartbeat or mailbox cron lands on),
  - lossless fallback: callers keep the raw markdown as the text/plain part.

Covers what mission reports actually use: h1-h4, paragraphs, **bold**, *italic*,
`code`, fenced code blocks, pipe tables, ordered/unordered lists (one nesting level),
blockquotes, links, horizontal rules. Unknown constructs degrade to escaped text.
"""
from __future__ import annotations

import html
import re

# Inline styles (email clients require them on each element).
_S = {
    "body": "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            "font-size:14px;line-height:1.55;color:#24292f;max-width:780px",
    "h1": "font-size:20px;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid #d8dee4",
    "h2": "font-size:17px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #eaeef2",
    "h3": "font-size:15px;margin:14px 0 6px",
    "h4": "font-size:14px;margin:12px 0 6px",
    "p": "margin:8px 0",
    "code": "font-family:Consolas,'SFMono-Regular',Menlo,monospace;font-size:92%;"
            "background:#f0f2f5;padding:1px 5px;border-radius:4px",
    "pre": "font-family:Consolas,'SFMono-Regular',Menlo,monospace;font-size:13px;"
           "background:#f6f8fa;border:1px solid #e1e6eb;border-radius:6px;"
           "padding:10px 12px;overflow-x:auto;white-space:pre-wrap;margin:8px 0",
    "table": "border-collapse:collapse;margin:10px 0;width:100%",
    "th": "border:1px solid #d8dee4;background:#f0f2f5;padding:5px 9px;text-align:left;"
          "font-size:13px",
    "td": "border:1px solid #d8dee4;padding:5px 9px;font-size:13px;vertical-align:top",
    "ul": "margin:6px 0;padding-left:24px",
    "ol": "margin:6px 0;padding-left:24px",
    "li": "margin:3px 0",
    "blockquote": "margin:8px 0;padding:2px 12px;border-left:4px solid #d8dee4;color:#57606a",
    "hr": "border:none;border-top:1px solid #d8dee4;margin:14px 0",
    "a": "color:#0a66c2",
}

_FENCE = re.compile(r"^(```|~~~)")
_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
_HR = re.compile(r"^ {0,3}([-*_])( ?\1){2,}\s*$")
_OL_ITEM = re.compile(r"^(\s*)\d+[.)]\s+(.*)$")
_UL_ITEM = re.compile(r"^(\s*)[-*+]\s+(.*)$")
_TABLE_SEP = re.compile(r"^\s*\|?[\s:|-]+\|[\s:|-]*$")

_CODESPAN = re.compile(r"`([^`]+)`")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
_ITALIC = re.compile(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])")
_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
_AUTOLINK = re.compile(r"(?<![\"'>(\]])\bhttps?://[^\s<>()\[\]{}\"']+")


def render(text: str) -> str:
    """Render markdown to a self-contained inline-styled HTML fragment."""
    out: list[str] = [f'<div style="{_S["body"]}">']
    lines = text.splitlines()
    i, n = 0, len(lines)
    para: list[str] = []

    def flush_para() -> None:
        if para:
            out.append(f'<p style="{_S["p"]}">{_inline(" ".join(para))}</p>')
            para.clear()

    while i < n:
        line = lines[i]

        if _FENCE.match(line.strip()):
            flush_para()
            i += 1
            block: list[str] = []
            while i < n and not _FENCE.match(lines[i].strip()):
                block.append(lines[i])
                i += 1
            i += 1  # closing fence (or EOF)
            out.append(f'<pre style="{_S["pre"]}">{html.escape("\n".join(block))}</pre>')
            continue

        m = _HEADING.match(line)
        if m:
            flush_para()
            level = min(len(m.group(1)), 4)
            out.append(f'<h{level} style="{_S[f"h{level}"]}">{_inline(m.group(2).strip())}</h{level}>')
            i += 1
            continue

        if _HR.match(line):
            flush_para()
            out.append(f'<hr style="{_S["hr"]}">')
            i += 1
            continue

        if line.lstrip().startswith(">"):
            flush_para()
            quoted: list[str] = []
            while i < n and lines[i].lstrip().startswith(">"):
                quoted.append(lines[i].lstrip()[1:].lstrip())
                i += 1
            inner = render("\n".join(quoted))
            out.append(f'<blockquote style="{_S["blockquote"]}">{inner}</blockquote>')
            continue

        if "|" in line and i + 1 < n and _TABLE_SEP.match(lines[i + 1]):
            flush_para()
            header = _table_cells(line)
            i += 2
            rows: list[list[str]] = []
            while i < n and "|" in lines[i] and lines[i].strip():
                rows.append(_table_cells(lines[i]))
                i += 1
            out.append(_table_html(header, rows))
            continue

        if _UL_ITEM.match(line) or _OL_ITEM.match(line):
            flush_para()
            i = _consume_list(lines, i, out)
            continue

        if not line.strip():
            flush_para()
            i += 1
            continue

        para.append(line.strip())
        i += 1

    flush_para()
    out.append("</div>")
    return "\n".join(out)


def _consume_list(lines: list[str], i: int, out: list[str]) -> int:
    """Consume one list (with one nesting level) starting at lines[i]; emit HTML."""
    first = _UL_ITEM.match(lines[i]) or _OL_ITEM.match(lines[i])
    base_indent = len(first.group(1))
    ordered = bool(_OL_ITEM.match(lines[i]) and not _UL_ITEM.match(lines[i]))
    tag = "ol" if ordered else "ul"
    items: list[str] = []
    n = len(lines)

    while i < n:
        m = _UL_ITEM.match(lines[i]) or _OL_ITEM.match(lines[i])
        if not m:
            # lazy continuation: indented non-item line continues the previous item
            if items and lines[i].strip() and lines[i].startswith(" " * (base_indent + 2)):
                items[-1] += " " + _inline(lines[i].strip())
                i += 1
                continue
            break
        indent = len(m.group(1))
        if indent > base_indent:
            sub: list[str] = []
            i = _consume_list(lines, i, sub)
            if items:
                items[-1] += "\n".join(sub)
            else:
                items.append("\n".join(sub))
            continue
        if indent < base_indent:
            break
        items.append(_inline(m.group(2).strip()))
        i += 1

    body = "".join(f'<li style="{_S["li"]}">{item}</li>' for item in items)
    out.append(f'<{tag} style="{_S[tag]}">{body}</{tag}>')
    return i


def _table_cells(line: str) -> list[str]:
    cells = line.strip().strip("|").split("|")
    return [c.strip() for c in cells]


def _table_html(header: list[str], rows: list[list[str]]) -> str:
    head = "".join(f'<th style="{_S["th"]}">{_inline(c)}</th>' for c in header)
    body = []
    for row in rows:
        row = row + [""] * (len(header) - len(row))
        body.append("<tr>" + "".join(
            f'<td style="{_S["td"]}">{_inline(c)}</td>' for c in row[:max(len(header), len(row))]
        ) + "</tr>")
    return (f'<table style="{_S["table"]}"><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table>')


def _inline(text: str) -> str:
    """Escape, then apply inline markdown. Code spans are protected from other rules."""
    escaped = html.escape(text, quote=False)
    spans: list[str] = []

    def stash(m: re.Match) -> str:
        spans.append(f'<code style="{_S["code"]}">{m.group(1)}</code>')
        return f"\x00{len(spans) - 1}\x00"

    escaped = _CODESPAN.sub(stash, escaped)
    escaped = _LINK.sub(lambda m: f'<a style="{_S["a"]}" href="{m.group(2)}">{m.group(1)}</a>', escaped)
    escaped = _AUTOLINK.sub(lambda m: f'<a style="{_S["a"]}" href="{m.group(0)}">{m.group(0)}</a>', escaped)
    escaped = _BOLD.sub(r"<strong>\1</strong>", escaped)
    escaped = _ITALIC.sub(r"<em>\1</em>", escaped)
    return re.sub(r"\x00(\d+)\x00", lambda m: spans[int(m.group(1))], escaped)
