# Dead-code cleanup — 2026-05-01 testplan

Three audit-flagged unused things removed. One PR. Ship to live.

## What's removed

1. **`paradigmName` field** on `CharacterState` ([lib/xse-schema.ts:672](lib/xse-schema.ts:672)) — written at [app/characters/random/page.tsx:160](app/characters/random/page.tsx:160), read nowhere. Pure metadata that never affected gameplay or display.

2. **`'paradigm'` variant** of `CreationMethod` ([lib/xse-schema.ts:26](lib/xse-schema.ts:26)) — set at [app/characters/random/page.tsx:161](app/characters/random/page.tsx:161), but `creationMethod === 'paradigm'` is never compared anywhere. The Paradigm-creation flow still works exactly the same — Paradigm RAPID/skills/equipment seeding happens upstream of this stamp; the field was just a label nothing read.

3. **`/api/logout` route** (`app/api/logout/route.ts`) — orphan. No caller in the codebase; every actual logout uses `supabase.auth.signOut()` directly from a component (Sidebar, LayoutShell). The route also had a hardcoded `localhost:3000` redirect that would have broken in production if anyone ever wired it up. Whole file + empty `app/api/logout/` directory deleted.

Existing characters in the DB with `data.creationMethod === 'paradigm'` or `data.paradigmName` set will still load fine — the JSONB column doesn't validate against the TS type, so unknown variants are silently ignored.

No DB migration. No functional behavior change for the user.

## Test plan

### A. Paradigm character flow still works (3 min)
- [ ] Open `/characters/paradigms`, pick a Paradigm.
- [ ] Land on `/characters/random?paradigm=<name>` and let it generate.
- [ ] Save the character. Verify the new row in `characters` has the Paradigm's RAPID + weapons + equipment baked in correctly.
- [ ] Open the character's view page — no crash, all stats render. (`paradigmName` and `creationMethod = 'paradigm'` are no longer set on new rows; the view never read them.)

### B. Logout still works (1 min)
- [ ] In the sidebar, click Logout. Verify redirect to `/login` and `getCachedAuth()` returns no user on next load.
- [ ] In LayoutShell's logout button (if rendered for your role), same check.
- [ ] Manually visit `/api/logout` in the browser → expect a 404 (route is gone).

### C. Smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] Open an existing character that was created via Paradigm pre-cleanup → loads cleanly.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
