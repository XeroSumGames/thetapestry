# Module clone batch insert — 2026-05-01 testplan

`cloneModuleIntoCampaign` was the last surface still using the per-scene `for await` pattern that `campaign-snapshot.ts` already shipped fixes for. One PR. Ship to live.

## What changed

[lib/modules.ts:420-505](lib/modules.ts:420). Pre-fix, the scenes/tokens insertion was:

```
for (const sceneRaw of snapshot.scenes) {
  ...
  await insert(scene)        // 1 round-trip per scene
  if (tokens) await insert(tokens)  // 1 round-trip per scene's tokens
}
```

A 20-scene module meant ~40 sequential round-trips. Post-fix:

1. Build all scene rows in one array (preserving order; scenes with no name still warn-and-skip up front).
2. One batched `INSERT ... RETURNING id` for all scenes.
3. Correlate input scenes to created scene ids by array index (Postgres preserves order on multi-row INSERTs with RETURNING).
4. Build all tokens across all scenes as a single flat array, mapping each to its scene's new id.
5. One batched `INSERT` for all tokens.

Same pattern proven in [lib/campaign-snapshot.ts](lib/campaign-snapshot.ts) for `restoreCampaignSnapshot` + `cloneSnapshotIntoCampaign`.

NPC remap (via `npcMap[t._npc_external_id]`) + null'd `character_id` semantics unchanged. Same `_external_id` tolerance for legacy `{ scene: {...}, tokens: [] }` snapshots.

Behavior change: a single bad scene now fails the whole batch instead of failing that scene and continuing. Acceptable because (a) clone runs into a fresh empty target campaign so the failure is recoverable by retrying, and (b) all-or-nothing is easier to reason about than partial success.

## Test plan

### A. End-to-end clone (5 min)
- [ ] Pick a published module that has multiple scenes (3+) with tokens. From `/campaigns/new`, choose that module and create a new campaign.
- [ ] Open the new campaign's `/table` — every scene from the module should appear in the scene list with the correct grid dimensions, background, cell_px, etc.
- [ ] Open each scene — tokens render at the right grid coordinates with the right portraits, colors, names. NPC-linked tokens point at NPCs that were cloned in step 1; PC-linked tokens are absent (correct — PCs don't travel).
- [ ] Confirm `counts.scenes` and `counts.tokens` in the return value match the input snapshot (no off-by-one).

### B. Network trace (1 min)
- [ ] In DevTools Network during the clone, confirm only ONE `tactical_scenes` insert and ONE `scene_tokens` insert (instead of N + N). Bulk inserts visible as single POSTs to the Supabase REST endpoint.

### C. Edge cases (3 min)
- [ ] Module with **zero scenes** → no insert calls; clone completes; no error.
- [ ] Module with scenes but **zero tokens** → only the scenes insert fires; tokens insert skipped.
- [ ] Module with a scene that's missing `name` → that scene gets the warn-and-skip path; the rest of the scenes still clone correctly.

### D. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during a normal module clone.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
