#!/bin/sh
# Install the Tapestry pre-commit hook into .git/hooks/pre-commit.
#
# Git hooks live outside the repo (in .git/hooks), so version-controlling
# them requires a copy step. Run this script once after cloning, or after
# `.git/hooks/pre-commit` ever gets wiped/regenerated.
#
# Idempotent: overwrites the existing hook with the canonical content
# below. If you've added custom local-only checks, back them up first.
#
# Usage:
#   sh scripts/install-hooks.sh
#
# The hook itself:
#   - check-font-sizes.mjs (no inline fontSize < 13px, no banned color combo)
#   - check-role-literals.mjs (no inline role-string comparisons)
#   - check-tab-device.mjs (only Frame.tsx renders the role=tablist tab device)
#   - check-preview-sync.mjs (preview file kept in sync with narrative source)
#   - check-em-dashes.mjs (no em-dash / en-dash in code, per project rule)
#   - check-arch.mjs (architecture ratchets: LOC ceilings, seam leakage, prod console)
#   - arch:depcruise (dependency-direction lint via dependency-cruiser)
#   - npm test (Vitest unit suite under tests/**/*.test.ts)
#
# To bypass for a single commit (not recommended): git commit --no-verify

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_DIR="$(git rev-parse --git-common-dir)"
HOOK_PATH="$GIT_DIR/hooks/pre-commit"

mkdir -p "$GIT_DIR/hooks"

cat > "$HOOK_PATH" <<'EOF'
#!/bin/sh
# Tapestry pre-commit guardrails.
# Bypass with `git commit --no-verify` (don't).
# Regenerate via `sh scripts/install-hooks.sh`.
set -e
node scripts/check-font-sizes.mjs
node scripts/check-role-literals.mjs
# Skips LOUDLY when the script is not in this worktree. The hook lives in the
# shared --git-common-dir, so it runs for EVERY worktree off this repo, but a
# newly added check only exists on branches that have picked it up. Hard-failing
# would kill commits in every lane that has not rebased yet, with no obvious
# cause. Same posture as check:publication / check:db-emdashes, which skip
# loudly rather than block when their precondition is missing.
if [ -f scripts/check-tab-device.mjs ]; then
  node scripts/check-tab-device.mjs
else
  echo "[check-tab-device] SKIPPED - not in this worktree. Rebase onto main to enable it."
fi
node scripts/check-preview-sync.mjs
node scripts/check-em-dashes.mjs
node scripts/check-arch.mjs
npm run arch:depcruise --silent
npm test --silent
EOF

chmod +x "$HOOK_PATH"
echo "Installed pre-commit hook at $HOOK_PATH"
