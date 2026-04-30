# Testplan — Module clone snapshot-shape fix (2026-04-29)

## What broke

Creating a new Empty (or Chased / Mongrels / Arena / Basement) campaign
threw:

> `Campaign created but module clone failed: pins: null value in column "name" of relation "campaign_pins" violates not-null constraint`

## Two-layer root cause

1. The Thriver migration tool at
   `app/tools/migrate-settings-to-modules/page.tsx` was building module
   snapshots in the **wrong shape** — it produced the
   `cloneSnapshotIntoCampaign` (campaign-snapshot) shape and stored it
   where `cloneModuleIntoCampaign` later tried to read it as a
   `ModuleSnapshot`. Field-name mismatches:
   - Pins: stored as `title`, snapshot type expects `name`
   - Scenes: wrapped `{ scene, tokens }`, snapshot type expects flat
   - NPCs: missing `_external_id` and using `id`/`campaign_id`
   - Handouts: silently dropped (sent under `notes`, never `handouts`)
2. `cloneModuleIntoCampaign` was a strict reader despite its own header
   comment claiming to be lenient. First field-name mismatch crashed
   the whole INSERT instead of skipping the row.

## What changed

### `lib/modules.ts` — clone is now genuinely lenient
- **Pins**: `name` falls through to `title` if missing. Pins with no
  resolvable name skip + warn (`console.warn`), don't crash. Adds
  legacy-id remap so NPCs that pointed at a campaign-snapshot pin id
  resolve.
- **Scenes**: tolerates the legacy `{ scene: {...inner}, tokens: [] }`
  wrapper alongside the canonical flat shape. Scenes with no name skip
  + warn.
- **NPCs**: `campaign_pin_id` (legacy) added as a fallback after
  `_pin_external_id` and `pin_name`. NPCs with no name skip + warn.
  Source-id remap for legacy snapshots.

### `app/tools/migrate-settings-to-modules/page.tsx` — produces the right shape now
- Pins map `SettingPin.title` → snapshot `name` (matches campaign_pins
  column).
- Scenes are flat with `tokens: []` nested.
- NPCs get `_external_id`.
- **Handouts are now included** — pulled from `SETTING_HANDOUTS`. Was
  silently dropped before (sent under `notes`, ignored by clone).
- **Idempotency now refreshes the snapshot too.** Previously re-running
  on an existing module only updated metadata and left the broken
  snapshot in place. Now it UPDATEs the latest version's snapshot to
  the current seed data. This is the path Xero uses to ship snapshot
  fixes — re-click the button on each affected setting.

## Required action from Xero (one-time)

The lenient reader means existing broken Empty/Chased/etc. modules
should now clone successfully without re-publishing. But the proper
long-term fix is to refresh the snapshots so they're stored in the
canonical shape:

1. Pull main on `C:\TheTapestry`.
2. Visit `/tools/migrate-settings-to-modules`.
3. Click each of the five setting buttons (Empty, Chased, Mongrels,
   Arena, Basement). Result panel will read
   `Refreshed existing module "<name>" — metadata + snapshot (N npcs, N pins, N scenes, N handouts).`
4. After all five refresh, the snapshots are in the canonical shape and
   the lenient-reader fallbacks are dormant safety nets.

## Test cases

### Critical path — the bug
1. **Create new Empty campaign** before any snapshot refresh → should
   succeed (lenient reader handles legacy shape). Pins, NPCs, scenes
   land. Confirm by opening Map and Assets tabs in the new campaign.
2. **Re-run migration on Empty** → result panel says "metadata +
   snapshot (...)". Confirm snapshot was UPDATEd by checking
   `module_versions.snapshot` jsonb in Supabase — pins should now have
   `name` keys.
3. **Create another new Empty campaign post-refresh** → still succeeds,
   no warnings in console (lenient fallbacks not triggered).

### Repeat for the other four
4. Chased — create campaign, refresh module, create again.
5. Mongrels — same.
6. Arena — same.
7. Basement — same.

### Handouts (new functionality)
8. Refresh Empty's snapshot → snapshot.handouts should have 1 entry
   ("Empty — Session Zero" per `SETTING_HANDOUTS.empty`).
9. Create new Empty campaign post-refresh → GM Notes tab shows the
   "Empty — Session Zero" handout. Players see no handouts (Share
   toggle off by default — same as setting-seed flow).

### Defensive paths
10. **Hand-corrupt a snapshot to test fallback** — in Supabase,
    UPDATE one pin in a module's snapshot to remove its `name` field
    entirely. Try to clone that module → console warns
    `[cloneModuleIntoCampaign] pin row has no name/title — skipping:`,
    other pins land OK, no crash.
11. **Hand-corrupt a scene wrapping** — UPDATE a scene to `{ scene:
    {...}, tokens: [] }` legacy shape → clone succeeds via lenient
    fallback.

### Smoke (no regressions)
12. Existing campaign-snapshot restore (`CampaignSnapshots` page) — not
    touched by this change. Confirm a restore still works on a
    Mongrels / Arena snapshot.
13. Module publish from a real campaign (not the migration tool) —
    `buildModuleSnapshot` in `lib/modules.ts` is unchanged. Publish a
    test campaign as a module, subscribe a fresh campaign to it,
    confirm clone works.

## Files touched

- `lib/modules.ts` — lenient reader for pins / scenes / npcs in `cloneModuleIntoCampaign`.
- `app/tools/migrate-settings-to-modules/page.tsx` — `buildSnapshot` now produces canonical `ModuleSnapshot`; idempotency refreshes the existing snapshot on re-run; handouts included.
- No SQL migrations.

## Rollback

Single commit. Revert via `git revert` if needed. No data migration
performed automatically — the lenient reader is the safety net that
makes existing broken snapshots usable; the manual refresh is opt-in.
