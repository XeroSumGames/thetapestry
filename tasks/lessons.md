# Lessons Learned

## Database & Auth
- **Role is now normalized to lowercase**: DB trigger `trg_normalize_role` auto-lowercases `profiles.role` on insert/update. All existing rows backfilled. Always compare against `'thriver'` / `'survivor'` (lowercase). No more `.toLowerCase()` needed — but harmless if left in.
- **RLS blocks everything by default**: When creating new tables, always add RLS policies immediately. Storage buckets need separate policies on `storage.objects` — the bucket existing is not enough.
- **Supabase Storage buckets must be created manually**: They don't auto-create from code. Each bucket needs INSERT/SELECT/DELETE policies on `storage.objects` filtered by `bucket_id`.
- **Column must exist before code references it**: Always provide the ALTER TABLE SQL alongside the commit. Don't assume the user has run previous SQL.

- **Null-coalescing chains can create false positives**: `npc.wp_current ?? npc.wp_max ?? 10` evaluates to `0` (and filters as "dead") when both fields are null. Only filter entities as dead when their health field has been explicitly set to 0, not when it's null/uninitialized. Use `npc.wp_current != null && npc.wp_current <= 0` instead.
- **Realtime subscriptions must match the events you need**: Subscribing to `INSERT` only means `DELETE` events are invisible to other clients. If a feature clears data (like session end deleting logs), use `event: '*'` so all clients see the change.

## React & Next.js
- **Emoji icons don't respond to CSS `color`**: Emojis render as images. Use SVG icons if you need color to change dynamically (e.g., notification bell).
- **`await` your Supabase calls**: Fire-and-forget (`supabase.from(...).update(...)` without `await`) causes race conditions. The Realtime subscription can fire before the write completes, reading stale data.
- **Optimistic state updates prevent stale reads**: When updating a value (like insight dice), update the local state immediately in addition to the DB write. Don't rely solely on Realtime to propagate changes.
- **Layout flash on conditional rendering**: If a layout element (sidebar) depends on async state, the page will flash/jump when that state resolves. Fix by either always showing or always hiding the element on that route, not conditionally based on async data.
- **`return null` during loading causes layout shifts**: Use `return <div style={{ background: '#0f0f0f' }} />` instead to maintain the DOM structure.

## Tactical Map
- **Tokens always spawn at top-left (1,1)**: All tokens (PC, NPC, objects) spawn at grid position (1, 1) — top-left of the tactical map. Never top-right. The GM controls strip is on the left but tokens go there anyway — the GM drags them to position. This was changed back and forth; top-left is the final decision.

## Client-Side Image Processing
- **Canvas center-crop pattern**: `const srcSize = Math.min(w, h); sx = (w - srcSize) / 2; sy = (h - srcSize) / 2` then `ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT)` — crops to square from center before resizing. Set `ctx.imageSmoothingQuality = 'high'` for the downscale.
- **Quality slider live-update**: Keep the loaded `HTMLImageElement` in a ref so changing quality can re-run `processImage` without re-reading the file. A `useEffect([quality])` triggers re-processing only when quality changes.
- **File input re-selection**: After `onChange`, reset `e.target.value = ''` so the user can pick the same file again (e.g., after resetting state).
- **`<input type="file">` click-to-browse on drop zone**: Hide the input with `display: none`, use a ref, and call `fileInputRef.current?.click()` from the drop zone's `onClick`. Clicking anywhere in the zone opens the picker.
- **`canvas.toBlob` vs `canvas.toDataURL`**: `toBlob` is async and gives you the exact file size for display; `toDataURL` is synchronous and gives a string suitable for `<img src>` and `<a download>`. Use both in parallel when you need both size stats and a preview URL.

## Styling
- **Banned combo: `fontSize: '12px'` + `color: '#3a3a3a'`**: Use `13px` + `#cce0f5` instead. The pair is illegible on the dark theme even though each value passes its own guardrail. Applies site-wide — `node scripts/check-font-sizes.mjs` flags violations. Rule recorded in `AGENTS.md` under UI conventions.
- **Header buttons must all be the same size**: The campaign table header bar uses the `hdrBtn()` helper for uniform 28px height, 11px Barlow Condensed buttons. When adding new buttons to this bar, ALWAYS use `hdrBtn()` — never inline custom styles. This has been broken and fixed before. Check `hdrBtn` usage before adding any button to the header.

- **`#5a5550` is too dim**: This color was used as secondary text throughout the app but is nearly invisible on dark backgrounds. Replaced globally with `#cce0f5` (light blue).
- **Minimum font size is 13px**: Never use font sizes below 13px anywhere in the UI. The dark background makes small text unreadable. Badges/tags: 13-14px. Body text: 14-15px. Headings scale up from there. Multiple rounds of +2px bumps were needed across roll feed, session history, and NPC roster because initial sizes were too small.
- **`appearance: 'none'` on selects**: Required for consistent cross-browser styling of dropdowns.
- **Grid needs enough container width**: `auto-fill` grids won't show multiple columns if the parent container is too narrow (e.g., constrained by sidebar). Use fixed column count (`repeat(5, 1fr)`) when you know the layout.

## Architecture
- **Extract large features into components**: The table page was getting huge. NpcRoster, NotificationBell, and VisitLogger were extracted as separate components to keep the main page manageable.
- **Store structured data, serialize for display**: Skills are stored as `{ entries: [...], text: "..." }` — structured for programmatic use, text for backwards compatibility and display.
- **`SECURITY DEFINER` on trigger functions**: Required for triggers that insert into tables with RLS (like notifications), since triggers run as the invoking user who may not have insert permissions.

## Process
- **Always provide SQL upfront**: When a feature requires a DB schema change, provide the ALTER TABLE / CREATE TABLE SQL immediately in the same message — don't wait for the user to ask. The user shouldn't have to chase for it. This is explicitly required in CLAUDE.md: "Always provide the ALTER TABLE SQL alongside the commit."

- **Provide all pending SQL in order**: When multiple features add columns/tables, the user may not have run earlier SQL. Always check and provide the full chain.
- **Debug logging is essential for remote debugging**: When the user can't see what's happening, add `console.log` with prefixed tags like `[EndSession]`, `[StatUpdate]`, then remove after diagnosis.
- **Test on the actual deployment**: localhost behavior can differ from deployed behavior (caching, env vars, auth state).
- **Verify the DB table/column exists before assuming code works**: A 400 error or silent null often means the schema doesn't match the code.
- **Supabase auth triggers must use EXCEPTION handler**: If a trigger on `auth.users` fails, Supabase rolls back the entire transaction including user creation, showing "Database error saving new user". Always wrap trigger INSERT in EXCEPTION WHEN OTHERS to prevent blocking signup. The client-side fallback code handles profile creation if the trigger fails.
- **CHECK constraints vs trigger values**: The `handle_new_user` trigger was inserting `'survivor'` (lowercase) but `profiles.role` has a CHECK constraint requiring `'Survivor'` (capitalized). Always match exact casing in trigger functions.

## 2026-04-11 session

- **Silent Supabase UPDATE failures under RLS are the #1 "feature looks broken but code looks fine" cause**: Supabase `.update()` returns `{ error: {...} }` without throwing. `console.warn('[tag] update error:', error.message)` is easy to lose in the noise. For writes that MUST land (combat state, action consumption, turn advance), check the `error` return AND think about whose client is making the call — if the write path runs on the player's client, RLS policies that allow only GM writes will silently drop every update. Nana bug: player attacks fired, roll logs landed, but `initiative_order.actions_remaining` never decremented because the player's client couldn't UPDATE the table. The symptom looks identical to "consumeAction isn't being called" but it's actually "consumeAction IS called, the UPDATE returns an error, we logged it once and moved on".

- **Pseudo-weapons sneak past `getWeaponByName` inference**: `Unarmed` (and anything else fabricated inline in the UI with `{ weaponName, damage, rpPercent }`) has no entry in `MELEE_WEAPONS` / `RANGED_WEAPONS`, so `getWeaponByName('Unarmed')` returns `undefined` and `isMelee = w?.category === 'melee'` falls through to `false`. That cascades: `rollDamage(..., !isMelee)` skips PHY AMod, and mitigation uses DEX instead of PHY. Fix the *inference*, not the damage pipeline — `isMelee = w?.category === 'melee' || weapon.weaponName === 'Unarmed'`. There was already a precedent at line 1481 special-casing `weaponName === 'Unarmed'` for Low-Insight weapon jams, so this has been stepped on before.

- **Label parsing is not a reliable way to identify the attacker**: `pendingRoll.label.split(' — ')[0]` works for NPC attacks (`Gio — Attack (Pistol)`) and consume-action logs (`David — Aim`), but breaks for PC weapon labels (`Attack — Crossbow`) where the first token is literally the word "Attack". Two separate bugs landed in the same week from this: (1) `roll_log.character_name` got the string `"Attack"` written into it, and (2) attacker-identity gating in `handleRollRequest` couldn't distinguish a known-name prefix from a generic action prefix. **Only trust `labelParts[0]` when it actually matches a known PC or NPC name** (check `entries` and `campaignNpcs`); otherwise fall back to `syncedSelectedEntry → myEntry`.

- **GM authority is the wrong escape hatch for turn-order gates**: The first cut of the combat gate let GMs bypass "is it this combatant's turn?" via `if (!iAmActive && !isGM) reject`. That let the GM click Attack on an off-turn NPC's NpcCard; the modal opened, the roll fired, `closeRollModal` then fetched `is_active = true` from the DB, which at that point was a *different* combatant, and consumed *their* action. The fix is to identify the attacker from label/context (NPC name from label, PC name from open sheet / current user) and require `attacker === active` *without* a GM override. GM still works via the `selectedEntry` branch (GM has the active PC's sheet open → attacker = that PC).

- **Postgres_changes on npc_relationships is flaky**: Subscribing to `postgres_changes` on `npc_relationships` with `event: '*'` does not reliably deliver updates to player clients — most likely the table isn't in the `supabase_realtime` publication, or RLS blocks the payload from reaching the player's channel. When the GM reveals an NPC mid-combat, the player's reveal list didn't refresh until a full page reload. Fix: send a `broadcast` event on a channel the player is already subscribed to (the `initiative_${id}` channel is a good shared bus), and have the handler refetch `campaign_npcs` fresh before calling `loadRevealedNpcs`. Broadcast events bypass RLS and publication settings entirely — they're peer-to-peer on the channel.
- **SECURITY DEFINER doesn't always bypass RLS in Supabase**: Despite documentation, trigger functions with SECURITY DEFINER may still be blocked by RLS policies. Add an EXCEPTION handler as a safety net.

## 2026-04-12 session

- **Cross-client state updates require broadcast, not just setState**: When a player deals damage to an NPC, `setCampaignNpcs`/`setViewingNpcs` only update the player's own React state. The GM's browser is a separate client and never sees the change unless Supabase Realtime fires (unreliable) or a broadcast event is sent. Fix: broadcast `npc_damaged` through the initiative channel (same pattern as `turn_changed`/`combat_ended`) with the patch payload. All clients listen and apply the patch locally. This is why NPC→PC damage worked (GM rolls, GM's state updates) but PC→NPC didn't (player rolls, GM's state stale).

- **Header bar buttons/badges must ALL use the `hdrBtn()` helper**: Every button, badge, link, and select in the table header bar must use `hdrBtn(bg, color, border)` for uniform sizing (28px height, 14px horizontal padding, 70px min-width, 11px Barlow Condensed, inline-flex centering). No inline style overrides for sizing. The helper is defined at the bottom of `page.tsx`. This includes `<select>`, `<a>`, and `<div>` badges — not just `<button>`. If adding new controls to the header, use `hdrBtn()` and nothing else for the base style.

- **Tactical map GM strip buttons must be uniform**: All buttons, labels, and selects in the TacticalMap left strip must be 28px height, 100% width, 13px Barlow Condensed, uppercase, text centered both horizontally and vertically (`display: flex, alignItems: center, justifyContent: center`). Use `boxSizing: border-box`. No exceptions.
