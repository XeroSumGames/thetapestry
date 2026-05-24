# SECURITY FINDING - map_pins world-pin moderation is client-enforced only (2026-05-24)

**Found by:** Playwright E2E lane, while building `world-pin-to-queue.spec.ts` (Ch2.1).
**Routed to:** puffer-fish lane (owns security / Risk Register / RLS + trigger changes).
**Severity:** MEDIUM - content-moderation evasion on a shared public surface. Not a data breach or privilege escalation beyond content; no PII exposure. Same bug CLASS the campfire moderation trigger already closed (Y3 pre-launch audit).
**Status:** **RESOLVED 2026-05-24 - fix APPLIED to live + verified (Xero-authorized).** `sql/map-pins-moderation-enforce-2026-05-24.sql` applied via the linked CLI; `trg_enforce_map_pin_moderation` (SECURITY DEFINER) confirmed present on `map_pins`, and a non-Thriver-context `gm`/`approved` insert was forced to `rumor`/`pending` (transactional test, zero rows persisted). Risk Register flipped RED -> GREEN. Remaining: E2E lane to add the "Survivor REST insert -> forced pending" regression assertion. Revert if ever needed: `DROP TRIGGER trg_enforce_map_pin_moderation ON public.map_pins`.

---

## The finding

World-map pin moderation (pending vs approved) is decided **only in the browser**, with **no server-side enforcement**:

- `components/MapView.tsx:948` - `pin_type: isThriver ? 'gm' : 'rumor'`, `status: isThriver ? 'approved' : 'pending'`.
- Same client rule in `components/QuickAddModal.tsx:236`.
- There is **NO `BEFORE INSERT` trigger on `map_pins`**. The only insert trigger is `on_new_pin` (`notify_new_pin`, `sql/thriver-queue-notifications.sql`) which just fires a bell for `pin_type='rumor' AND status='pending'` - it does not set or correct status.
- The campfire tables (`forum_threads`, `war_stories`, `lfg_posts`) **were** hardened against this exact pattern: `enforce_moderation_on_insert` (`sql/moderation-enforce-trigger-2026-05-17.sql`) overwrites the client's `moderation_status` off the real `auth.uid()` role. `map_pins` was not included.

## Threat / repro

The Supabase anon key is public (shipped in the client bundle), and any registered user has their own session token. So a non-Thriver (Survivor) can bypass the queue with a direct REST insert - no UI, no special tooling:

```
POST /rest/v1/map_pins
  Authorization: Bearer <their own session token>
  apikey: <public anon key>
  { user_id: <self>, lat, lng, title, notes,
    pin_type: 'gm', status: 'approved', category: 'location' }
```

The map_pins INSERT RLS only checks `user_id = auth.uid()` (+ suspension + a 50/window rate limit) - it does NOT constrain `status` or `pin_type` by role. The SELECT policy (`"View pins"`) shows any `status='approved'` pin to **everyone** (incl. anon). So the crafted pin is published world-wide, styled as a GM pin, with zero moderation review.

**Confirmed indirectly by the E2E test:** the legit flow (a Survivor's `rumor`/`pending` pin) is correctly hidden from other players and surfaced in the Thriver queue - proving the SELECT/queue side works. The gap is purely that nothing forces a non-Thriver's pin to `pending` server-side.

## Recommended fix (design for puffer-fish to refine)

Extend the moderation-enforce pattern to `map_pins` with a `BEFORE INSERT` trigger (SECURITY DEFINER, reads `profiles.role`). Sketch:

- If the inserting user IS a Thriver: respect the values (Thrivers are the moderation layer), as campfire does.
- If NOT a Thriver:
  - A genuinely private pin (`pin_type='private'`) stays owner-only (`status='active'`) - private pins are not shown to others by the SELECT policy, so they are not a public-exposure vector. Leave them be.
  - A world/shared pin (anything a non-Thriver tries to publish - `pin_type IN ('gm','rumor')` or `status='approved'`) is FORCED to `pin_type='rumor'`, `status='pending'`. A non-Thriver can never produce `pin_type='gm'` or `status='approved'`.

Nuance vs the campfire trigger: campfire keys off `campaign_id IS NULL` (scope); `map_pins` has no `campaign_id` (world pins are a separate table from `campaign_pins`), so the map trigger keys off `pin_type` / the private-vs-shared distinction instead. Verify against `MapView.tsx` + `QuickAddModal.tsx` so legitimate private pins and the world-share path are preserved.

Apply via `npx supabase db query --linked -f sql/<file>.sql` and commit the SQL (no dashboard-only changes). Add an E2E follow-up once the trigger lands: the campfire-style "Survivor REST insert with status='approved' -> trigger forces pending" assertion (mirror `campfire-social.spec.ts`), which the E2E lane will add.

## References
- Existing precedent to mirror: `sql/moderation-enforce-trigger-2026-05-17.sql`.
- Client rule: `components/MapView.tsx:948`, `components/QuickAddModal.tsx:236`.
- Table + RLS: `sql/_baseline/schema.sql` (map_pins ~line 513; policies "Insert own pins"/`map_pins_insert`, "View pins", "Delete pins").
- The test that surfaced it: `e2e/world-pin-to-queue.spec.ts`.
