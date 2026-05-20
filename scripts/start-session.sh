#!/bin/sh
# scripts/start-session.sh
#
# Run at the start of every non-trivial session to see what landed in
# main since your last push + warn about likely collision points with
# files you're about to edit.
#
# Per tasks/lessons.md "Verify shipped state before assuming uncontested
# scope" + tasks/operating-mode.md "Multi-chat lanes". The puffer-fish
# vs hunt-and-peck split means parallel work routinely collides on the
# same files. This script makes the collision visible BEFORE you start
# editing, instead of at push time.
#
# Output is informational; nothing is changed in the working tree.
#
# Usage:
#   sh scripts/start-session.sh
#
# Exit codes:
#   0  always (informational)
#
# Re-run any time you suspect drift: between major work units, before
# starting a structural change, after a long break from the project.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---- Fetch + headline ---------------------------------------------------

echo "==> Fetching origin/main..."
git fetch origin main --quiet 2>/dev/null || {
  echo "  (fetch failed - offline or auth issue; continuing with cached state)"
}

LOCAL_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REMOTE_HEAD=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

echo ""
echo "==> HEAD state"
echo "  local:  $(git log -1 --oneline HEAD 2>/dev/null)"
echo "  remote: $(git log -1 --oneline origin/main 2>/dev/null)"

if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
  echo "  status: in sync"
elif [ "$LOCAL_HEAD" = "unknown" ] || [ "$REMOTE_HEAD" = "unknown" ]; then
  echo "  status: unknown (one ref missing)"
else
  AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
  BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
  echo "  status: $AHEAD ahead, $BEHIND behind"
fi

# ---- Incoming commits (what shipped while you were away) ----------------

echo ""
echo "==> Commits in origin/main NOT in your local HEAD"
INCOMING=$(git log --oneline HEAD..origin/main 2>/dev/null)
if [ -z "$INCOMING" ]; then
  echo "  (none - you're up to date)"
  INCOMING_COUNT=0
else
  echo "$INCOMING" | head -20
  INCOMING_COUNT=$(echo "$INCOMING" | wc -l)
  if [ "$INCOMING_COUNT" -gt 20 ]; then
    echo "  ... ($INCOMING_COUNT total; showing first 20)"
  fi
fi

# ---- Touched files (collision surface) ----------------------------------

echo ""
echo "==> Files touched by incoming commits"
TOUCHED=$(git diff --name-only HEAD..origin/main 2>/dev/null)
if [ -z "$TOUCHED" ]; then
  echo "  (none)"
  TOUCHED_COUNT=0
else
  echo "$TOUCHED" | head -25
  TOUCHED_COUNT=$(echo "$TOUCHED" | wc -l)
  if [ "$TOUCHED_COUNT" -gt 25 ]; then
    echo "  ... ($TOUCHED_COUNT total; showing first 25)"
  fi
fi

# ---- Collision warning: working-tree edits that overlap incoming --------

echo ""
echo "==> Collision check"
DIRTY=$(git status --short | awk '{print $2}' | grep -v "^$" || true)
if [ -z "$DIRTY" ] || [ -z "$TOUCHED" ]; then
  echo "  (no working-tree files OR no incoming changes; no collision risk)"
else
  COLLISIONS=$(echo "$DIRTY" | while read -r f; do
    echo "$TOUCHED" | grep -F -x "$f" 2>/dev/null
  done | grep -v "^$" || true)
  if [ -z "$COLLISIONS" ]; then
    echo "  (clean - your working-tree files do not overlap incoming changes)"
  else
    echo "  WARNING: working-tree files overlap with incoming commits."
    echo "  Editing these will likely conflict at rebase / push time:"
    echo "$COLLISIONS" | sed 's/^/    /'
  fi
fi

# ---- Working tree summary -----------------------------------------------

echo ""
echo "==> Working tree (uncommitted)"
WT=$(git status --short | head -10)
if [ -z "$WT" ]; then
  echo "  (clean)"
else
  echo "$WT"
  WT_COUNT=$(git status --short | wc -l)
  if [ "$WT_COUNT" -gt 10 ]; then
    echo "  ... ($WT_COUNT total; showing first 10)"
  fi
fi

# ---- Recent log context -------------------------------------------------

echo ""
echo "==> Last 5 commits on origin/main"
git log --oneline origin/main -5 2>/dev/null

# ---- Tooling pointers ---------------------------------------------------

echo ""
echo "==> Tooling pointers"
echo "  Pre-commit hook:        sh scripts/install-hooks.sh (re-install if missing)"
echo "  Gates (manual):         npx tsc --noEmit"
echo "                          node scripts/check-font-sizes.mjs"
echo "                          node scripts/check-role-literals.mjs"
echo "                          node scripts/check-em-dashes.mjs"
echo "                          node scripts/check-preview-sync.mjs"
echo "  Test suite:             npm test --silent"
echo "  Confidence-Ledger:      node scripts/refresh-ledger.mjs (drains stale test-count drift)"
echo "  Lane reference:         tasks/operating-mode.md \"Multi-chat lanes\""
echo "  Risk Register:          tasks/debug-handoff.md Sec 1"

# ---- Next-step suggestion ----------------------------------------------

echo ""
echo "==> Suggested next step"
if [ "$INCOMING_COUNT" -gt 0 ]; then
  if [ -n "$WT" ]; then
    echo "  - You have working-tree changes AND incoming commits to integrate."
    echo "  - Safest path:"
    echo "      git stash push -m 'pre-session-sync' -u"
    echo "      git pull --rebase origin main"
    echo "      git stash pop"
  else
    echo "  - Clean working tree + incoming commits: git pull --rebase origin main"
  fi
else
  echo "  - You're up to date with main. Pick a task and ship."
fi
echo ""
