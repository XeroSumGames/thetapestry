# Master Punch List - toward Beta-500 (consolidated 2026-06-23)

One place for everything open, pulled from: stability-audit-2026-06-23, supabase-advisor-triage-2026-06-23, handoff-hp-scale-onboarding-2026-06-23, the 2026-06-23 playtest notes, and todo.md CURRENT OPEN. Status + owner + severity on each. The deep granular backlog still lives in todo.md; this is the high-signal consolidation.

Owners: **PF** = Puffer (SQL/RLS/realtime/infra). **HP** = Hunt & Peck (app code). **X** = Xero (content/canon/decision). **OP** = operator (dashboard/env).

---

## DONE this session (for context - not open)
Security RLS hardening (characters/character_states/roll_log reads + roll_log insert + campaign-covers + module-covers writes), pregen_campaign_map RLS, 11 hot-FK indexes, search_path pinned on 33 definer fns, pregen->profiles FK. Recorder observability shipped + the pregen feature + Intimidation->Manipulation collapse. All live + verified.

---

## SECURITY (PF) - finish before opening to strangers
- [ ] **M-SEC-1 [MED] `campaign_members` read** still `auth.role()='authenticated'` (any user reads the whole membership graph). Needs a SECURITY DEFINER `is_campaign_member()` helper to scope without RLS recursion (players must still see co-members for the party list).
- [ ] **M-SEC-2 [MED] `object-tokens` storage** INSERT gates only on `bucket_id` - any logged-in user uploads arbitrary images. Scope INSERT to campaign member (folder = campaign_id; confirm player-upload path first).
- [ ] **L-SEC-1 [LOW] `portrait_bank`** INSERT/SELECT both `true` - low-sensitivity shared pool; gate on owner col or document as intentional.
- [ ] **[LOW batch] Advisor leftovers:** 23 non-definer fns w/ mutable search_path; ~42 multiple-permissive-policy merges; ~55 cold provenance-FK indexes (approved_by/created_by/published_by/source_module_id). None gate beta.

## SCALE / REALTIME FAN-OUT
- [ ] **H-SCALE-1 [HIGH -> PF]** campaign-scope the 3 unfiltered `postgres_changes` subs (`scene_tokens`, `npc_relationships`, `community_members` in table page) - add `filter: campaign_id=eq.${id}`. Routed back to PF from HP. Biggest realtime win.
- [ ] **H-SCALE-2 [HIGH -> HP]** Sidebar presence-roster re-queries `profiles` on every presence sync (the `/characters` storm). Debounce + delta-cache.
- [ ] **H-SCALE-3 [HIGH -> HP]** cap/paginate unbounded reads: `rollLogForCampaign`, `getCampaignNpcs` (status-filter).
- [ ] **M-SCALE-1 [MED -> HP]** full-refetch realtime handlers -> apply payloads incrementally (`character_states`/`chat_messages`/`roll_log`; `campaign_npcs` shows the pattern).
- [ ] **M-SCALE-2 [MED -> HP]** batch the `campaign-clock` drainer N+1 loops into `.in()` + multi-row writes.
- [ ] **[LOW -> PF]** verify/add composite indexes `(campaign_id, created_at)` on roll_log/chat_messages; campaign_id on character_states/campaign_npcs.
- [ ] **[OP/PF] realtime scale sanity** - Supabase concurrent-connection cap + small concurrent-client load test before 500 users.

## REALTIME DESYNC (PF)
- [ ] **M-RT-1 [MED]** grid/lock settings (`show_grid`/`grid_color`/`grid_opacity`/`is_locked`) are `isFirstLoad`-gated, so a GM toggling them mid-session doesn't reach already-loaded players. Apply on the `!isGM` branch like `cell_px`. (The one genuine realtime-desync bug from the audit.)
- [ ] **[HIGH - re-triage] LOS through open windows** - architecture is SOUND (propagation path exists end-to-end). Needs LIVE instrumentation of the `tactical_scenes` postgres handler to confirm whether the event reaches the player, before any fix. Add belt-and-suspenders `walls_changed` broadcast as hardening. Do NOT ship an architecture "fix." May be partly stale.
- [ ] **L-RT-1 [LOW]** `lighting_mode` shares walls' single-delivery path; give it the same fallback broadcast only if LOS triage shows a delivery problem.

## ONBOARDING - cold-signup bounce (HP)
- [ ] **H-UX-1 [HIGH]** No discoverable "Join a Story" for a cold signup (dashboard + sidebar are GM-funnel only). Single biggest bounce risk.
- [ ] **H-UX-2 [HIGH]** `/characters/random` is an infinite-spinner dead-end when logged out (no GhostWall/redirect).
- [ ] **H-UX-3 [HIGH]** Hardest path (Backstory) styled as the default; lead first-timers with Paradigm/pregen.
- [ ] **M-UX-1 [MED]** jargon (CDP/RAPID/AMod/SMod/CMod) no inline glossary - first-use tooltips.
- [ ] **M-UX-2 [MED]** mojibake `Ufffd` glyphs in Quick Character (`quick/page.tsx:245,291,324,351,353`) - ASCII.
- [ ] **M-UX-3 [MED]** `creationMethod` mis-stamped ('backstory' on the Quick path).
- [ ] **L-UX [LOW]** Paradigm flow flashes "Random Character" heading; unlabeled green Pregen button needs `title=`; secondary-stat legend on saved card.

## COMBAT + CONTENT (from playtests)
- [ ] **[FEATURE -> HP] Hidden-NPC fog occlusion** - a SHOW token renders for a player only when their PC can see the cell (rides the per-player vision system; settles Group/Individual lighting too).
- [ ] **[BUG - PARKED, X watching] Gus couldn't ready an inventory gun** - "Equip from Inventory" filters to catalog-name matches, so a custom-named gun never appears (`page.tsx:9527`). Awaiting repro detail.
- [ ] **[AUDIT - X + HP] Weapons list completeness + damage balance** - add missing (e.g. Revolver), then damage-consistency pass across `lib/weapons.ts`. Damage values are Xero's canon call.
- [ ] **[CONTENT - X] David Battersby pregen bio wrong era** - reads the Chased post-seizure backstory but appears on EMPTY (farm still intact). Needs a pre-Chased bio; apply via UPDATE on the official pregen row + mirror in `sql/seed-official-pregens.sql`.
- [ ] **[VERIFY owed] Disarm 2-client** - testplan `tasks/disarm-loot-testplan-2026-06-23.md` (disarm -> ground token -> loot -> Ready -> fire).
- [~] **[HP] Grapple canon expansion** - defender action loss + grappler Subdue (partially shipped; E2E + verify owed).

## RECORDER (HP)
- [ ] **[MED] Snapshot over-redaction** - `selected_token_id` + `token_count` come back `[redacted]` (the privacy filter strips any key containing "token"). Rename keys or exempt game-domain token fields - the snapshot is useless for combat diagnosis otherwise.
- [ ] **[LOW] Mark prompt** - replace `window.prompt()` with an in-app input.
- [ ] **[LOW] Stuck-click clusters on canvas** - low-priority UX investigation from a player dump (hit-box vs token-select latch).

## UI / UX POLISH BACKLOG (HP)
- [ ] Native `<select>` friction on 3 modal surfaces (both Xero + Tony hit it).
- [ ] ADD NPC > NEW NPC modal is cumbersome/cluttered - streamline.
- [ ] NPC card popout must never scroll off-viewport.
- [ ] NPC sheet: support multiple weapons AND equipment items (currently 1 primary + 1 optional).
- [ ] Inventory: a way to remove/consume an item ("remove a medicine bag").
- [ ] Modal-shell migration Phases A3/B/C/E (Gut-Instinct dropdown, First Impression, inline ATTACK reconcile, the 13 non-roll modals) - large, post-playtest, Xero-gated on the ATTACK one.
- [ ] Target-dropdown faction coloring (allies green / hostiles red relative to roller).

## KS / BETA LAUNCH PREP (X + HP + OP)
- [ ] **F1 [X decision -> HP]** what the KS link points to + what `/` shows a cold logged-out visitor (today it drops them into the app, not a pitch).
- [ ] **F2 [X content -> HP]** `/publiclanding` is a DRAFT (placeholder copy, empty screenshot boxes, "Request Beta Access" framing).
- [ ] **[X] Moderation capacity** - can 2 people clear `/moderate` for 500 users? + a user report/abuse path (server-side enforcement is solid; the human-capacity + report-UI question isn't).
- [ ] **[OP/PF] Recovery floor** - no PITR confirmed; `audit_log` AL2 triggers capture nothing yet. Confirm backup cadence + decide if AL2 wiring is pre-beta.
- [ ] **[E2E + manual] Pre-beta green light** - full `npm run test:e2e` + combat-flow (#10) covered/smoked.

## INFRA / TEST (PF/E2E)
- [ ] `scripts/check-realtime-wrap.mjs` guardrail (now unblocked).
- [ ] Add the Supabase advisor/linter to the standing pre-ship checklist (lesson 2026-06-23).
- [ ] E2E: deterministic vehicle-check regression spec; re-cert tactical-map-render for the fit-to-width model; npc-recruitment / advantages-lifecycle / community-status-upgrade specs.

---

## The honest cut line for Beta-500 (~7/1)
**Must:** the SECURITY MED items (M-SEC-1/2), the SCALE HIGH trio (H-SCALE-1/2/3), the ONBOARDING HIGH trio (H-UX-1/2/3), F1/F2 landing, moderation/report path, recovery-floor decision, pre-beta E2E smoke.
**Should:** M-RT-1 grid desync, recorder snapshot redaction, the weapons + David-bio content, Disarm verify.
**Later (post-beta / KS-polish):** everything LOW, the modal-migration phases, the UI polish backlog, advisor LOW batch.
