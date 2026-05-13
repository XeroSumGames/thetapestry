# Campaign Sheet Phase 3 testplan

Migrates the remaining time-advance surfaces into `lib/campaign-clock.ts`
so all four converge on `advance()`. Sub-phased; this file grows as each
ships.

## Sub-phases

- ✅ **3a** `d77d9cd` - table-page "Advance Time" modal now also ticks
  the canonical clock after the RP encumbrance update lands.
- ⬜ **3b** - rations consumption drainer.
- ⬜ **3c** - subsistence damage drainer (1 WP + 1 RP per day past
  day 2 without rations; CRB Ch.07 p.117).
- ⬜ **3d** - community Skip Week becomes `advance(168)`.

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
