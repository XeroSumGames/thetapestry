# Finding - 3s vehicles poll is redundant load (Beta-500 scale) - 2026-06-29

**Lane:** found by Puffer Fish (realtime/scale) during the Item 1 realtime 2-client
verify. **Routed to:** Hunt & Peck (the fix is a one-line edit in the table page,
which is HP's hot file - PF does not cross-edit it).

## What the recorder dumps showed

Two synchronized playtest recorder dumps (GM `xerosumgames` + player `tony_bushell`,
same campaign `7219ea37`, 2026-06-29 19:01-19:03) each fire
`GET /rest/v1/campaigns?select=vehicles&id=eq.<id>` **every ~3 seconds for the entire
session** - ~40 calls in the GM's 127s, ~30 in the player's 98s. Steady, unconditional,
does nothing the vast majority of the time.

At Beta-500 (500 concurrent open table pages) that is ~167 req/s of pure poll overhead,
indefinitely, independent of whether any vehicle ever changes.

## Root cause

`app/stories/[id]/table/page.tsx:3090`:

```js
const pollId = window.setInterval(() => { void refetchVehicles() }, 3000)
```

`refetchVehicles` (line 3056) re-reads `campaigns.vehicles`. The inline comment
(line 3067-3072) frames it as a "last-resort guarantee" because the jsonb-over-realtime
path "keeps dropping under load." That justification predates this session's realtime
hardening.

## Why it is now redundant

The seat-assignment update is a write to `campaigns.vehicles` (a jsonb column ON the
campaigns row), so it is a `campaigns` UPDATE. Two event-driven paths already deliver it:

1. **`campaigns:UPDATE` postgres_changes sub** (line 1550) - its handler at **line 1557**
   already does `if (Array.isArray(row.vehicles)) setVehicles(row.vehicles)`, reading the
   jsonb straight off `payload.new`. `campaigns` is in the realtime publication and this
   session's recordings show its sibling campaign-filtered subs (`scene_tokens`,
   `tactical_scenes`, `campaign_npcs`) all delivering reliably GM->player at 100-600ms.
2. **`vehicle_updated` broadcast -> `refetchVehicles`** (line 3052 comment) - TacticalMap
   already calls `refetchVehicles` event-driven when the tactical channel receives the
   popout's `vehicle_updated` broadcast.

Plus three cross-tab fallbacks (storage event, BroadcastChannel, window focus) for the
same-browser popout case. The blind 3s poll is the 5th and weakest mechanism and is the
only one that costs steady DB load while idle.

## Recommended fix (HP, one line)

Remove the `setInterval(... , 3000)` poll at line 3090 (and its `clearInterval` in the
cleanup at line 3096). Keep the realtime payload path, the `vehicle_updated` broadcast
refetch, and the 3 cross-tab mechanisms - all event-driven, all $0 while idle.

If a safety net is still wanted, raise the interval to >=30s instead of removing it - that
alone cuts this poll's load 10x while preserving belt-and-suspenders. Removing is cleaner;
the realtime + broadcast paths are now the proven primaries.

## Verify after the fix

Re-run the 2-client recorder pass (GM + player), GM reassigns a vehicle seat in the
popout, confirm the player's `vehicles` state updates with the poll gone (driven by
`campaigns:UPDATE` and/or `vehicle_updated`). Confirm `campaigns?select=vehicles` no
longer appears on a 3s cadence in either dump.
