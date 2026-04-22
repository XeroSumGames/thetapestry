#!/usr/bin/env bash
# extract-rules.sh — reproducible PDF → text extraction for rulebooks
#
# Wraps pdftotext so every extraction uses the same flags + output
# conventions. Use this anytime you want to pull a chapter out of a
# rulebook PDF into something I (Claude) can read easily.
#
# Requires: pdftotext (installed as part of Git Bash on Windows via
# mingw64; `which pdftotext` should return /mingw64/bin/pdftotext).
#
# Usage:
#   scripts/extract-rules.sh <pdf-path>                        # full text → stdout
#   scripts/extract-rules.sh <pdf-path> <out.txt>              # full text → file
#   scripts/extract-rules.sh <pdf-path> <out.txt> <from> <to>  # page range
#
# Examples:
#   scripts/extract-rules.sh "docs/Rules/XSE SRD v1.1.17 (Small).pdf" /tmp/srd.txt
#   scripts/extract-rules.sh "docs/Rules/XSE SRD v1.1.17 (Small).pdf" /tmp/srd-combat.txt 14 18
#   scripts/extract-rules.sh "docs/Rules/Distemper CRB v0.9.2.pdf"

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <pdf-path> [out-file] [first-page] [last-page] [flow|layout]" >&2
  echo "  flow   = default: reflow text as a single column (better for prose)" >&2
  echo "  layout = preserve columns + tables (better for table-heavy chapters)" >&2
  exit 1
fi

PDF="$1"
OUT="${2:--}"              # '-' = stdout
FIRST="${3:-}"
LAST="${4:-}"
MODE="${5:-flow}"          # flow (default, single column) or layout (preserve columns)

if [[ ! -f "$PDF" ]]; then
  echo "error: PDF not found: $PDF" >&2
  exit 1
fi

# Flags:
#   -layout       preserve horizontal layout (tables, columns).
#                 Good for table-heavy chapters, bad for two-column prose.
#   (no -layout)  reflow prose as one column. Good default.
#   -enc UTF-8    force UTF-8 output so special chars survive.
#   -f / -l       page range (inclusive).
args=(-enc UTF-8)
if [[ "$MODE" == "layout" ]]; then args+=(-layout); fi
if [[ -n "$FIRST" ]]; then args+=(-f "$FIRST"); fi
if [[ -n "$LAST" ]];  then args+=(-l "$LAST");  fi

pdftotext "${args[@]}" "$PDF" "$OUT"

if [[ "$OUT" != "-" ]]; then
  LINES=$(wc -l < "$OUT")
  echo "wrote $OUT ($LINES lines)"
fi
