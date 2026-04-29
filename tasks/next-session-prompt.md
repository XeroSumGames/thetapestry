# Clean-Chat Opening Prompt

Paste this into the next chat to give Claude full context cold.

---

I'm Xero, the dev on **The Tapestry** (Distemperverse) — Next.js + Supabase
TTRPG platform for the XSE/Distemper system. We're between sessions; the last
arc closed clean. Read these in order before doing anything:

1. `tasks/handoff.md` — the most recent handoff (2026-04-29). TL;DR + what
   shipped + critical file locations + open backlog.
2. `tasks/todo.md` — the full backlog, with the latest ✅ block at the top.
3. `CLAUDE.md` and `AGENTS.md` — workflow rules (especially: this is a
   modified Next.js, read `node_modules/next/dist/docs/` before guessing).
4. `C:\Users\tony_\.claude\projects\C--TheTapestry\memory\MEMORY.md` — your
   own memory index. Heed especially:
   - Persistent fontSize 13px floor, no exceptions
   - All git/merge/push ops are yours end-to-end (don't ask permission)
   - Push to live, test on live (Vercel = dev env, Xero is the only real user)
   - After every push from a worktree: `git -C C:/TheTapestry pull origin main`

## Status check

- Worktree: clean, on `main` after `af15ca1`
- `C:\TheTapestry` synced to `main`
- No SQL pending **except** `sql/modules-sort-order.sql` — Xero hasn't
  confirmed it's applied; re-check by querying `SELECT name, sort_order
  FROM modules ORDER BY sort_order` in Supabase.

## Open the conversation with this question

> "What's next — backlog item, or did the playtest surface new bugs?"

If Xero says "backlog," surface the top candidates from the handoff:
1. **Restore-to-Full-Health perf** — multi-target restore is N sequential
   round-trips; batch into 3 concurrent table-scoped UPDATEs.
2. **Streamline player login** — login → join → table is too many steps;
   needs discussion before shipping.
3. **Hide-NPCs reveal UX** — data layer works, reveal flow needs fewer
   clicks; needs discussion.
4. **Vehicles + Handouts** in `cloneSnapshotIntoCampaign` v1.1.0 (parked).
5. **Re-run `/tools/migrate-settings-to-modules`** to refresh stale module
   descriptions/order in DB.

If Xero says "playtest bugs," capture them as discrete TODO items first,
then bug-fix one at a time — each commit small and focused per the workflow
rules.

## Don'ts

- Don't ever tell Xero to run a migration manually if you can ship it as a
  one-shot SQL file with idempotent ALTER/UPDATE statements.
- Don't introduce a `supabase.auth.getUser()` call. Use `getCachedAuth()`.
- Don't write a fontSize below 13px in any inline `style={{ }}`.
- Don't open a feature branch — push to main, test on Vercel.
- Don't do half-fixes. The standard is "would a staff engineer approve this?"
