# Spec: Playtest recorder observability upgrade (network / realtime / state / click context)

**Status:** DRAFT for path-validation (2026-06-18)
**Origin:** Knox's 2026-06-16 dump was 26 raw Leaflet clicks + nothing else - diagnostically useless. The recorder is blind to the things playtest bugs actually live in. This closes the four highest-value gaps.
**Lanes:** Puffer Fish specs (observability). Hunt & Peck wires it (`lib/playtest-recorder.ts`, `components/PlaytestRecorder.tsx`, `lib/sentry-realtime.ts`, a thin fetch wrap). Almost purely additive.
**What exists today:** captures `click | route | error | rejection | console-error | console-warn | mark | custom(trace)`. Wiring in `components/PlaytestRecorder.tsx`; buffer + `record()` + `redact()` in `lib/playtest-recorder.ts`.

---

## HARD privacy invariant (do not break)
The recorder NEVER captures input values, cookies, localStorage contents, or auth tokens (see `redact()`). Every addition below stays inside that line:
- **Capture:** URLs, HTTP methods, status codes, durations, table names, event types, channel/subscription status, game-object IDs, boolean flags, counts, enum/approach strings.
- **NEVER capture:** request bodies, response bodies, form/input values, character free-text, chat text, tokens. Route everything new through `redact()` and add a body-stripping rule.

## New event kinds
Extend `PlaytestEvent['kind']` union:
`'net' | 'realtime' | 'snapshot'` (plus the existing set). Click stays `'click'` but gains richer `data`.

---

## Item 1 - Network / RPC capture (HIGHEST value)
**Why:** most "I clicked it and nothing happened" bugs are a failed/slow Supabase call (RLS 400, rejected RPC, 500). Today: invisible. The wall-segment-door silent-RLS-gate bug would have been one line in the dump.

**How:** wrap `fetch` once in `PlaytestRecorder` mount (same pattern as the console monkey-patch). Only record calls to the Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`) so we don't log unrelated traffic.

**Record per call (`kind: 'net'`):**
```
{ method, url_path,           // pathname + ?rpc name; STRIP query values that aren't table/rpc identifiers
  status,                     // 200/400/401/403/404/500...
  ok,                         // status < 400
  duration_ms,
  table_or_rpc,               // parsed: 'characters' | 'rpc/gm_apply_damage' | 'auth' ...
  error_code, error_message } // from the JSON error envelope IF present - message only, NO row data
```
- **Do NOT log request or response bodies.** Parse only the error envelope's `code`/`message` (Supabase/PostgREST error shape), nothing else.
- Slow-call signal: any call over ~1500ms gets `slow: true` so "felt laggy" becomes greppable.

## Item 2 - Realtime events + subscription health
**Why:** desync bugs (silently dead subscription per AGENTS.md, pins-catchup visibilitychange, tactical-map desync) are the second-biggest class and 100% invisible today. We see the click that should have propagated, never that the broadcast didn't arrive.

**How:** the Sentry realtime wrappers already exist (`lib/sentry-realtime.ts` `wrapBroadcast`/`wrapDbChange`, used by `useCampaignChannel`/`usePostgresSubscription`). Tee them into `record()` - one extra line per wrapper, no new subscription plumbing.

**Record (`kind: 'realtime'`):**
```
{ direction: 'in',            // inbound event received
  transport: 'broadcast'|'postgres_changes',
  event,                      // event name / change type (INSERT/UPDATE/DELETE)
  table,                      // for postgres_changes
  channel }                   // channel topic
```
- **Subscription status changes** (the dead-sub tell): record on the `.subscribe((status) => ...)` callback - `{ kind:'realtime', direction:'status', channel, status }` where status ∈ SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED.
- **NO payload bodies** - event name/table/status only.

## Item 3 - State snapshot on mark + error
**Why:** every dump is context-free. A snapshot makes it self-diagnosing. The charge/cancel chase would have been one line: actions_remaining + token position at dump time.

**How:** a `getSnapshot()` provider the table page registers on `window.__tapestrySnapshot` (like `__tapestryMark`). `record()` calls it and attaches a `kind:'snapshot'` event automatically right BEFORE any `error`/`rejection`/`mark`, and once on dump.

**Snapshot fields (all IDs/flags, no PII):**
```
{ active_entry_id, active_combatant_name,   // whose turn
  actions_remaining,
  scene_id, scene_kind,                      // tactical/campaign
  open_modal,                                // which modal id is mounted, or null
  selected_token_id, selected_npc_id,
  combat_active, my_character_id,
  token_count, initiative_count }
```
- Table page owns the provider (it has this state). Recorder just invokes it defensively (try/catch, never throw).

## Item 4 - Richer click target (cheap, makes map/canvas clicks meaningful)
**Why:** Knox's 26 `leaflet-container` clicks were noise because we logged the raw div. Walk up to the nearest meaningful ancestor + grab any game-object id under the cursor.

**How:** in the existing `onClick` handler, in addition to the literal target, climb parents (max ~6) for the first element with a `data-testid`, `[role]`, `<button>`, `<a>`, or a `data-token-id`/`data-pin-id`/`data-npc-id`. Add to click `data`:
```
{ ...existing,
  nearest_interactive,   // tag + testid/role/text of the nearest actionable ancestor
  game_object }          // { kind:'token'|'pin'|'npc', id } if a data-* id is found, else null
```
- For Leaflet/canvas, also include `on_map: true` + the layer class so map clicks are at least categorized.
- Needs a few `data-token-id` / `data-pin-id` attributes on the map/canvas layers (small additive H&P change; flag any new attrs in active-lanes first per the testid policy).

---

## Item 5 - Broader `trace()` coverage (follow-on, not blocking)
Sprinkle `trace('<action>', {...ids})` on the key NON-combat flows so sessions like Knox's aren't blank: campaign-map pin open, token place/move, recruit submit, inventory transfer, rest start/finish. Each is one line; `trace()` is free when the recorder is off. Do after 1-4 land.

---

## Files (Hunt & Peck)
- `lib/playtest-recorder.ts` - extend `kind` union; add body-strip rule to `redact()`; `record()` auto-attaches a snapshot before error/rejection/mark.
- `components/PlaytestRecorder.tsx` - fetch wrap (Item 1); enrich `onClick` (Item 4); call `__tapestrySnapshot` (Item 3).
- `lib/sentry-realtime.ts` (+ the two hooks) - tee `wrapBroadcast`/`wrapDbChange` + subscribe-status into `record()` (Item 2).
- `app/stories/[id]/table/page.tsx` - register `window.__tapestrySnapshot = () => ({...})` (Item 3); add a few `data-*-id` attrs on map/token layers (Item 4).
- Bump `app_version` in `dumpBuffer()` (currently the stale literal `'playtest-2026-05-04'`).

## Verification
- Unit: `redact()` strips bodies/values from a synthetic `net`/`realtime` event; snapshot provider returns IDs not PII.
- Manual: enable recorder, force a 403 (RLS) + a dead channel + open/close a modal + click a token + click empty map → dump shows `net` (403 + code), `realtime` status, `snapshot` on mark, click with `game_object`.
- Privacy spot-check: grep a real dump for any character free-text / input value / token - must be zero.

## Out of scope
Perf/long-task capture, input-control identity, tab-visibility/scroll events - lower value; revisit if a bug class demands them.
