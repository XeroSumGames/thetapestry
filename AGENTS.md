<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI conventions

- **Minimum inline fontSize is 13px.** (Raised from 12 → 13 on 2026-04-23.) Never write `fontSize: '9px'` through `'12px'` in `style={{ ... }}` props - even for badges, chips, or micro-labels. If something looks too big at 13, use color/weight/layout instead. Guardrail: `node scripts/check-font-sizes.mjs` reports offenders; `--fix` rewrites them to 13.
- **Banned combo: `fontSize: '13px'` + `color: '#3a3a3a'`.** That pairing is illegible on dark backgrounds. Use `color: '#cce0f5'` instead. The font-size guardrail script flags the combo (no auto-fix - the right replacement color can vary by context, but default to `#cce0f5`).
- **Popout routes never show the global sidebar.** `LayoutShell.tsx`'s `FULL_WIDTH_PATTERN` auto-hides the sidebar for any pathname ending in `-sheet` or `-popout`, or under `/popout/...`. Name new popout routes accordingly (e.g. `/foo-sheet`, `/foo-popout`) and they'll be sidebar-free with no further edits.

## Role comparisons

- **Never write `'Thriver'` / `'Survivor'` / `'Ghost'` capital-case literals in app code.** The DB normalises `profiles.role` to lowercase via `trg_normalize_role`, so capital-case comparisons silently never match post-migration. Hidden features for whole role groups have been shipped because of this.
- **For reads:** import `isThriver` / `isSurvivor` / `isGhost` from `lib/auth/roles.ts`. They accept either a raw role string or a profile-shaped object with `.role`, and handle null / non-string inputs safely.
- **For writes:** import the `THRIVER` / `SURVIVOR` / `GHOST` constants from the same module. The DB trigger would lowercase anyway, but writing the constant keeps local optimistic state consistent with on-disk state.
- **Guardrail:** `node scripts/check-role-literals.mjs` scans `app/`, `components/`, `lib/`, `scripts/` for raw capital-case role literals and fails the run on any offender. Add `role-literal-allow` to a UI-only line to suppress.

## Database / infra-as-code

- **Supabase realtime needs the table in the publication.** A `postgres_changes` subscription on a table that is NOT in the `supabase_realtime` publication is silently dead - no error, no event, nothing. When you add a `postgres_changes` sub on a NEW table (via `usePostgresSubscription` or `useCampaignChannel` `postgres[]`), you MUST add it to the publication in the SAME change: add an `ALTER PUBLICATION supabase_realtime ADD TABLE <name>;` line to `sql/_baseline/publication.sql` AND apply it to live (`npx supabase db query --linked -f ...`). `broadcast` events do NOT need this - only `postgres_changes`.
- **`sql/_baseline/publication.sql` is the source of truth** for publication membership. **Guardrail:** `npm run check:publication` (`scripts/check-publication-drift.mjs`) diffs the live publication against that file and fails on drift. It needs the linked DB + network, so it is an ON-DEMAND / pre-ship check, not a blind pre-commit/CI gate (skips loudly when offline). Run it before shipping anything realtime-touching.
- **No `supabase/migrations/` workflow here.** Schema/config changes are applied as `sql/` files via `npx supabase db query --linked -f sql/<file>.sql`. Keep publication / RLS / trigger changes in committed `sql/` files - never dashboard-only (dashboard-only config is how the silent-config bug class happens). Live-DB application is a bright-line action: confirm intent first.
