# Campaign Sheet Phase 3 testplan

Migrates the remaining time-advance surfaces into `lib/campaign-clock.ts`
so all four converge on `advance()`. Sub-phased; this file grows as each
ships.

## Sub-phases

- ✅ **3a** `d77d9cd` - table-page "Advance Time" modal now also ticks
  the canonical clock after the RP encumbrance update lands.
- ✅ **3b** `aa20bdb` - rations consumption drainer (one ration per
  PC per day boundary).
- ✅ **3c** `36feee3` - subsistence damage drainer (1 WP + 1 RP per
  day past day 2 without rations; CRB Ch.07 p.117).
- ✅ **3d** `80bc8f3` - community Skip Week ticks the campaign clock
  168h forward in addition to the week_number bump.

---

## 3a verification - 2026-05-12

Setup: a campaign with at least one PC who is currently overencumbered
(carrying more than `6 + PHY + backpack` ENC).

### Golden path

1. Open the campaign-sheet popout. Note the clock value
   (e.g. `Day 5 · 14:00`).
2. Go back to the table view. Open the Advance Time modal (GM control).
3. Set hours = 4. Modal should preview which characters lose RP.
4. Click Apply.
5. Affected characters' RP drops as expected (Phase 2 behavior, unchanged).
6. **New behavior:** the campaign-sheet popout's clock should now read
   `Day 5 · 18:00`. Streaming-heal events scheduled to drain by 18:00
   should apply on the same tick (visible in character WP/RP).

### Edge cases

- **No one overencumbered.** Modal's Apply button is disabled (`Nothing
  to apply`). Clock does NOT tick from this path. This is intentional:
  for clean fast-forwards (sleep, travel) use the campaign-sheet
  popout's `[+Nh]` button instead.
- **Concurrent GMs.** If two GM clients click Apply at the same time,
  each call to `advance()` is non-idempotent (advance(4) twice = +8h).
  Existing `setAdvanceTimeBusy` guard prevents double-clicks on a single
  client; cross-client is still a theoretical race but won't corrupt
  state, just over-advance.
- **Clock broadcast loss.** If the `clock_advanced` Realtime broadcast
  drops, the `campaigns` table UPDATE still fires and the popout's
  `postgres_changes` subscription catches it. No data loss, slight
  display lag.

### Regression checks

- The RP encumbrance tick + Stress/Incap pipeline still works exactly
  as before (Phase 2 behavior).
- The `⏳ Time advances ${h}h · overencumbered: ...` System row still
  posts to `roll_log` with the same shape.
- Streaming heals queued before 3a still drain at the right tick.

### Revert

```
git -C /c/TheTapestry revert d77d9cd
git -C /c/TheTapestry push origin main
```

---

## 3b verification - 2026-05-12

Setup: a campaign with at least one PC carrying rations
(`characters.data.rations = { type: "Standard Rations", count: 2 }` by default).

### Golden path

1. Note the PC's current rations count.
2. From the campaign-sheet popout, advance time by 24h (1 day).
3. After the advance, that PC's rations count should drop by 1.
4. The roll feed should show a `🍞 Rations consumed (1d): <PC> (2 to 1)` row.
5. Advance time again by 48h (2 days). Rations count drops by 2; if the
   PC went from 1 -> 0 mid-advance, the row marks them `(1 to 0, out)`.
6. Once a PC is at 0, subsequent advances don't change their rations
   count (and 3c subsistence kicks in instead).

### Edge cases

- **dayDelta = 0 (advances under 24h).** No rations consumed. Feed shows
  no `🍞` row.
- **PC with 0 rations at start.** Skipped entirely. No row, no decrement.
- **Multiple PCs.** Single summary row lists all affected, comma-separated.

---

## 3c verification - 2026-05-12

Setup: a campaign with a PC who has 0 rations and `out_since_day`
stamped on `characters.data.rations` (the simplest way: start them
with 1 ration and advance 24h so they hit 0; out_since_day will be
stamped at that moment).

### Golden path

1. PC is now out of rations (day 1 of starvation, no damage yet).
2. Advance 24h. Still no damage (day 2, grace period).
3. Advance another 24h. PC now at day 3 of starvation. They lose
   1 WP + 1 RP. Roll feed shows
   `🪦 Subsistence damage: <PC> (-1 WP/-1 RP, 5->4 WP, 5->4 RP)`.
4. Advance 48h (2 more hungry days). PC loses 2 more WP and 2 more RP.

### Mortal/incap pipeline

- If a subsistence tick drives the PC's WP to 0 from positive,
  they auto-fill 1 Stress pip (cap 5) - same as any other mortal
  hit.
- Same for RP=0 transitions (auto-incap + Stress pip).

### Self-heal: PC eats again

- If GM/player adds rations back to the PC (count > 0) without
  going through the inventory UI's reset, the next subsistence
  drain pass clears `out_since_day` + `last_subsistence_day`
  automatically. No damage applied on a fed PC.

### Edge cases

- **PC with `out_since_day = null` but `count = 0`** (e.g. character
  created with no rations from the start). Skipped - we don't know
  when they started starving.
- **Overlapping advances.** `last_subsistence_day` prevents
  double-application. Advancing 2d then 2d more is identical to
  advancing 4d once.

---

## 3d verification - 2026-05-12

Setup: a campaign with at least one community.

### Golden path

1. Open the Campaign Community panel. Note a community's
   `week_number` and the campaign-sheet popout's clock state.
2. Click "Skip Week" on that community. Confirm the prompt (it now
   mentions the 7-day campaign clock advance and downstream effects).
3. After confirm:
   - Community `week_number` increments by 1 (unchanged behavior).
   - Campaign clock advances 168 hours (7 days). Visible in the
     campaign-sheet popout.
   - All PCs in the campaign consume 7 rations (or as many as they
     have, then go to 0). `🍞` summary row in the feed.
   - Any PC already past day 2 of starvation takes subsistence
     damage for each hungry day crossed by the advance. `🪦` summary
     row in the feed.
   - Any streaming heals scheduled to drain by the new clock fire.

### Edge case

- **Skip Week with no PCs in the campaign.** Community week_number
  bumps; campaign clock ticks; no `🍞` or `🪦` rows because the
  drainers find no characters to process.

---

## Full revert (all of Phase 3)

```
git -C /c/TheTapestry revert 80bc8f3 36feee3 aa20bdb d77d9cd
git -C /c/TheTapestry push origin main
```
