# Campaign Sheet — Phase 1 spec

Locked decisions per Xero 2026-05-12. Phase 1 ships the surface and the clock backbone; subsystem integrations (healing, rations, etc.) wait for Phase 2+.

## Storage model — Option A (canonical day)

- `campaigns.clock` jsonb. Default `{ "canon_day": 0, "hour": 0 }`.
- `canon_day` = absolute days since the canonical first death in Chile (2-Mar, Year 1 / 2025).
- `hour` = 0-23, in-world time within the current day.

Mongrels campaign starts at `canon_day: 563`. Chased = 379. On The Waterfront = 480. Each campaign records its own current `canon_day`; the timeline data is global / read-only.

## Event queue — `campaign_events` table

```sql
CREATE TABLE campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  scheduled_canon_day int NOT NULL,
  scheduled_canon_hour int NOT NULL DEFAULT 0,
  applied_canon_day int,
  applied_canon_hour int,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Event types planned for Phase 2+ (not built in Phase 1):
- `pending_heal_oneshot` — `{ wp, rp }` applied at scheduled time.
- `streaming_heal` — `{ total_wp, duration_hours, applied_wp, applied_remainder, source }` applied proportionally as time advances.
- `ration_consumed` — daily ration consumption.
- `subsistence_damage` — 1 WP + 1 RP per day past day 2.
- `world_event_expires` — CMod from a world event ends at scheduled time.
- (Future: condition_tick, fuel_consumed, ammo_consumed, etc.)

## Time advance

- **Tick buttons:** `[+1h] [+4h] [+8h] [+12h] [+24h]`. GM-only.
- `lib/campaign-clock.ts:advance(campaignId, hours, gmUserId)` is the only writer of `campaigns.clock`.
- Phase 1: just bumps the clock. No event draining.
- Phase 2: drains `campaign_events` where `(scheduled_canon_day, scheduled_canon_hour) <= new_clock` and `applied_canon_day IS NULL` and `cancelled_at IS NULL`. Each type has its own apply-function.

## Hard rules (locked)

1. **GM-only writes.** Players can read the sheet and see the clock + timeline + pending effects, but cannot advance the clock or apply pending effects early.
2. **Never show future events.** Timeline panel only renders entries where `canon_day <= clock.canon_day`. Future events are hidden from EVERYONE including the GM — the sheet is not a spoilers reference.
3. **Heal interruption.** If a target takes damage while a `streaming_heal` event is active, the event is cancelled (`cancelled_at = now, cancelled_reason = 'damage_taken'`) and remaining heal is lost. Phase 2 wires this.
4. **Streaming heals stack independently.** Multiple `streaming_heal` events can be active on the same target. Each drains on its own schedule.
5. **Real-world year is implicit.** Display shows `Day N / Month Day_ordinal, Year X` (e.g. `Day 563 / September 15th, Year 2`). Year_X is the in-game canon year (Year 1 = 2025 / Infection Year, Year 2 = 2026, etc.). No real-world year ever appears.

## Date math

- **Epoch:** 2 March 2025 (Year 1 / Day 0 / "First Recorded death in Chile").
- **Year boundaries:** calendar year boundaries (Jan 1 of each Gregorian year).
  - Year 1: Day 0 – Day 304 (Mar 2 – Dec 31, 2025).
  - Year 2: Day 305 – Day 669 (Jan 1 – Dec 31, 2026).
  - Year 3: Day 670 – Day 1034 (Jan 1 – Dec 31, 2027).
  - Year 4: Day 1035 – Day 1400 (Jan 1 – Dec 31, 2028; leap year, 366 days).
- **Discrepancy note:** the canon timeline table Xero provided has some Year 2 day numbers that are +1 vs strict Gregorian (e.g. 15-Sep = Day 563 per Xero, vs Day 562 per strict math). The timeline data file stores Xero's day numbers AS-IS for events; the calendar function uses strict Gregorian. The "on event day" display will match the table; intermediate days may differ by 1. To be revisited if cosmetic mismatch becomes a problem.

## UI surfaces

- **Route:** `/campaign-sheet?c=<campaignId>` — popout-style page (sidebar auto-hidden via `-sheet` suffix in LayoutShell `FULL_WIDTH_PATTERN`).
- **Three panels:**
  1. **Clock header:** `Day 563 / September 15th, Year 2 • 4 PM` + canon event subtitle if today is an event day.
  2. **Timeline panel:** past + present canon events, chronological. Each entry: `Day N • Month Day` + event name. Anything `canon_day > clock.canon_day` is hidden (locked rule #2).
  3. **Pending panel:** queued effects not yet applied or cancelled. Phase 1 renders empty / "No pending effects yet"; Phase 2 wires this for healing.
- **GM-only controls** above the clock header: `[+1h] [+4h] [+8h] [+12h] [+24h]` advance buttons.
- **Realtime:** clock changes broadcast on `campaign_clock_${campaignId}` channel so every viewer's sheet updates simultaneously.
- **Button to open:** added to the table page header (open to all members), opens the popout via `openPopout()`.

## Phase 1 deliverables

1. `sql/campaign-clock.sql` — adds `campaigns.clock` column + creates `campaign_events` table + RLS policies + indexes + `NOTIFY pgrst`.
2. `lib/distemper-timeline.ts` — canonical timeline data + `dayToCalendar()` pure function.
3. `lib/campaign-clock.ts` — `advance(campaignId, hours, gmUserId)` writer; clock-reader helper.
4. `app/campaign-sheet/page.tsx` — popout UI.
5. Table page header button to open the sheet.

## Out of scope for Phase 1 (Phase 2+)

- Wiring healing rolls to produce `streaming_heal` events.
- Draining events on advance.
- Rations / subsistence / ammo / fuel rows.
- Damage path checking for active streaming heals to cancel them on interruption.
- Migrating the existing Inventory "+1h" Time button to use `advance()`.
