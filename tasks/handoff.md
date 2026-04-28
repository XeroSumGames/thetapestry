# Session Handoff — 2026-04-27 (late session, pre-playtest)

## TL;DR
- Continuation of the morning's 2026-04-27 session. Shipped **7 commits**: HammerTime renderer, two cropper fixes, grenade fumble system, NPC card resize handle, map default center, NPC popout resize, and a console-spam filter extension.
- **About to enter playtest** — the new mechanics to watch are grenade fumbles + the cropper retry path. HammerTime + NPC card resize + NPC popout sizing are visual polish that should just work.
- Worktree: `C:\TheTapestry\.claude\worktrees\distracted-carson-293c9d` — `claude/distracted-carson-293c9d` tracks main. All commits pushed, main checkout synced.
- **Two parked items to mention before playtest:** NPC encumbrance bug (added to todo, "to be solved later") + the three carry-over playtest items still need repro screenshots.

## Run-Me SQL (carry-over from morning handoff — confirm if run)
These were flagged in the morning handoff. If you haven't run them yet:
```
notepad C:\TheTapestry\sql\community-morale-role-snapshot.sql
notepad C:\TheTapestry\sql\patch-minnie-floorplan-cachebust.sql
```
1. `community-morale-role-snapshot.sql` — adds `role_snapshot jsonb` to `community_morale_checks`. Without it, Phase D dashboard's role-coverage chart shows empty rows.
2. `patch-minnie-floorplan-cachebust.sql` — bumps Minnie's floorplan_url to `?v=20260427`.

No new SQL added this late session.

## What just shipped this session (7 commits, oldest first)
- `855a10c` **HammerTime `<t:UNIX>` renderer + URL linkifier** — single utility in `lib/rich-text.tsx` wired into 7 surfaces (DMs, table chat Chat+Both+whispers, forums thread+replies, LFG, GM Notes, Player Notes, Progression Log). Discord-spec format chars `t/T/d/D/f/F/R`. Hover tooltip shows full absolute date. Uses `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` — zero new deps.
- `2bf84db` **Cropper hang fix #1** — caches the decoded source `Image` in a ref (the second `new Image()` was hanging on certain PNGs). 15s watchdog on `canvas.toBlob`, 30s on supabase upload. Try/catch/finally. Errors surface in-modal so the user keeps their crop selection on retry.
- `fb3de50` **Grenade wild throw / in-hand detonation** — Failure scatters 1d8 dir × 1d4 cells from intended cell; Dire scatters 2d4 cells; Low Insight detonates at thrower's tile. New log line above the existing `Blast Radius — Engaged: X | Close: Y` header. Ammo still decrements on fumble (pin's pulled, can't undo). Off-map scatter clamps to grid_x/y >= 1.
- `dd2545d` **Cropper hang fix #2 (follow-up)** — `OUT_LONG_EDGE` 1024 → 768, JPEG quality 0.9 → 0.85, PNG-without-transparency falls back to JPEG (5-10× smaller). File `<input>`s now key on a counter and remount fresh after every upload (fixes Safari "can't pick another image"). Added explicit × clear button next to "✓ Custom image — click to replace".
- `a591ac7` **NPC card resize handle + Mediterranean map default** — drag the diagonal grip in the bottom-right corner of any in-combat draggable NPC card. Constrained 200-700 px wide × 150 px to 95vh tall. Session-only, not persisted. Plus map fallback now centers on Tyrrhenian Sea (38.6169, 15.2930) at zoom 3 — wide regional view that frames Europe + N Africa.
- `a871aef` **NPC popout 600×800 → 576×420** — user resized manually and reported the new comfortable size. Two call sites: `NpcCard.tsx` Popout button + `NpcRoster.tsx` row Popout button.
- `d12e552` **Console spam filter extension + parked backlog** — extends the existing `{x,y,w,h}` filter in `app/layout.tsx` to also drop bare two-number calls (both ints, 100-10000) coming from a different browser extension that logs `window.outerWidth, window.outerHeight` on every render. Also parked NPC encumbrance bug in `tasks/todo.md`.

## What's parked / blocked

**Carry-over from morning handoff** (still need playtest repro):
- **PLAYTEST #1 Damage math** — `2+2d6 (6) = 8 raw → should be 7 WP / 7 RP (1 mitigated)`. Need a screenshot of the actual log row.
- **PLAYTEST #2 Failed skill checks still leave 2 actions** — code looks correct on paper. Need: which character, which skill, what the `[consumeAction]` console log shows.
- **Last-minute #8 Give qty picker / #9 Unequip buttons** — code looks correct on inspection. Need: did the button appear, what happened on click, any console errors.
- **Mouse-drag pan in tactical** (long-term) — see `tasks/long-term-fixes.md`. WASD / arrow keys are the workaround.

**New parked this session:**
- **NPC inventory — primary & secondary weapons should count toward encumbrance** — currently NPC sheet shows `Weapons: 0` even when kitted. Added to `tasks/todo.md` with a pointer to `components/CharacterCard.tsx`'s working PC calc to reuse. User said "to be solved later" — don't fix mid-playtest.

## Watch-list during the playtest (new mechanics this session)

1. **Grenade fumbles** — most important. If a grenade roll is a Failure (4-8) or Dire Failure (≤3), the impact should scatter 1d8 direction × 1d4 (or 2d4) cells. If it's Low Insight (1+1), the grenade detonates at the thrower's tile. The expanded log entry should have a new line ABOVE the `Blast Radius — Engaged: X | Close: Y` header reading either:
   - `🎲 Wild throw — scattered NE 3 cells (9 ft). Impact: (12,7).`
   - `⚠️ Dire Failure — scattered SW 6 cells (18 ft). Impact: (9,12).`
   - `💥 Moment of Low Insight — grenade detonates in hand at thrower's cell (5,5).`

   Test plan: `tasks/grenade-fumble-testplan-2026-04-27.md` has all 7 scenarios + edge cases.

2. **Cropper retry path** — if an upload fails or stalls, the modal should now show an error inside the modal (not hang at "Processing…"). User can hit "Crop & Upload" again or Cancel. After successful upload, picking a 2nd image should work cleanly. After Vercel redeploys, retry the upload from the screenshot earlier today.

3. **Console spam** — should be gone after Vercel redeploys (~60s after the last push at `d12e552`). If still spamming, click the source link on a spam line in DevTools — `chrome-extension://...` confirms it's the extension; if it's `bundle.js` then we missed something.

4. **HammerTime tokens** — paste `<t:1762416000:F>` or `<t:1762416000:R>` into a chat / forum post / DM and confirm it renders as a styled blue chip with the absolute date as a hover tooltip. Test plan: `tasks/hammertime-testplan-2026-04-27.md`.

5. **NPC popout 576×420** — when you click Popout on any NPC card, the new window should open at 576 wide × 420 tall (matches your manual resize from earlier).

6. **NPC card resize handle** — bottom-right corner of any in-combat draggable NPC card has a small diagonal blue grip. Drag it. Width clamps 200-700, height 150 to 95vh.

7. **Map default center** — only matters for new campaigns without a setting. Existing campaigns with `map_center_lat/lng` stored in DB are unaffected.

## What's next on the roadmap (post-playtest pick)
Same as morning handoff, plus the new parked NPC encumbrance bug:
- **Communities Phase D continued** — Lv4 auto-CMods (blocked: Lv4 Skill Traits ship together or not at all per memory)
- **Modules MVP** — content engine, spec at `tasks/spec-modules.md`
- **Inventory polish** — qty picker / Unequip verification (need playtest repro), custom-item loot UI, full encumbrance UX
- **NPC encumbrance fix** — newly parked
- **GM role transfer + session scheduling**
- **Allow characters in multiple campaigns**

## Working tree state
- Branch: `claude/distracted-carson-293c9d` worktree at `C:\TheTapestry\.claude\worktrees\distracted-carson-293c9d`.
- All commits pushed to `origin/main`. Last commit: `d12e552`.
- `C:\TheTapestry` main checkout synced via `git -C C:/TheTapestry pull origin main` after every push (per memory rule).
- Vercel deploy pipeline auto-runs on push to main, ~60s lag.

## Known gotchas (lessons from this session)
- **File input doesn't reset reliably across browsers.** Setting `e.target.value = ''` works in most browsers but Safari (and sometimes Chrome) holds onto the prior selection. Solution: bump a `key` counter on the `<input>` element so React fully remounts it after each upload. Pattern landed in `components/CampaignObjects.tsx`.
- **PNG-without-transparency is a 5-10× upload-size waste.** Photos saved as PNG by mistake go through canvas → 1024 px → re-encode as PNG. Sample the canvas's alpha channel; if every pixel has alpha=255, output JPEG instead. Pattern in `components/ObjectImageCropper.tsx`.
- **Browser extensions can log on every page render.** The user has at least two extensions that flood `console.log` — one with `{x,y,w,h}` objects, one with bare two-number calls. Both are filtered in `app/layout.tsx` via a console.log monkey-patch in the `<head>`. Pattern is established for adding more filters as new extensions appear.
- **Grenade fumbles are a Blast Radius gate, not a weapon-name gate.** Future weapons with the Blast Radius trait (RPG, mortar, satchel charge) inherit the same wild-throw / in-hand behavior automatically. No per-weapon configuration.
- **`canvas.toBlob` can never fire.** On memory-pressured browsers or huge canvases, the callback is never invoked. Always wrap in a `Promise` with a timeout watchdog. Same pattern works for `supabase.storage.upload` — the upload promise can hang indefinitely without resolving or rejecting if the network drops. 30s timeout via `Promise.race` is sufficient.
- **The "576 420" pasted into the console wasn't the loop.** I misread it as DevTools history-replay; it was a real recurring extension-driven console.log. Pattern: when the user reports endless console output, look at `app/layout.tsx` first to see if there's an existing filter precedent — there might be a known extension to extend the filter for.

## Memory updates worth adding
- "File `<input>` reset via `e.target.value = ''` is unreliable on Safari. Bump a React `key` counter on the input to force-remount after every upload — this guarantees a fresh element."
- "PNG output should sample alpha and fall back to JPEG when no transparency exists. Pattern in `ObjectImageCropper.tsx`."
- "Browser-extension console spam can be filtered via a monkey-patch on `console.log` in `app/layout.tsx` `<head>`. Existing precedent for two patterns; add new ones as new extensions appear."
- "Grenade fumble rules — Failure: 1d8 dir × 1d4 cells. Dire: 2d4 cells. Low Insight: thrower's tile. Gated on Blast Radius trait, applies to any weapon with it."
