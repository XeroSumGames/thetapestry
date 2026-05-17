# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here — absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

## 2026-05-17 06:09 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` — DoS with Server Components (2 advisories); fix available: upgrade to 16.2.6 (non-semver-major)
- HIGH: `fast-uri` — host confusion via percent-encoded authority delimiters; fix available

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days old, no playtest update): Phase 3 a/b/c/d, 10 feed-audit drift fixes. Still in HOPED-FOR; all load-bearing (campaign-clock drainers, feed rows).
- Stale-todo check: no definitively-shipped-but-still-open items found. Intimidation removal still pending in `lib/npc-generator.ts` + `lib/setting-npcs.ts` (6+ sites). `app/rules/vehicles/` still absent.

**Action:** `npm i next@16.2.6` to patch the DoS vuln (non-breaking); then schedule a live playtest of the 2026-05-13 Phase 3 batch — campaign-clock drainers + feed rows are 4 days unverified.

---
