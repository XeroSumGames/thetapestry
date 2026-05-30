# Tactical-Map Smoketest - 2026-05-30

Tight proof-of-life after today's fixes. Five checks, ~5 minutes, 2 browsers.
If all five pass, the bug class is closed. Any fail tells me exactly where to dig.

**Fixes covered:**
- `c0d9fb8` - player viewport centers on own PC when char id arrives late
- `a068ffb` - "+ Map" re-spawns archived tokens instead of restoring stranded coords
- `38e59cb` - popout cell_px persist is click-only (no useEffect race)
- `31b28e9` - cell_px cap raised to 300 for high-DPI maps
- `aea76cd` - auto-fit grid persist failures now log to console

**Setup (one-time):**
- GM tab (Xero) on prod, hard-refreshed (Ctrl+Shift+R)
- Player tab (Tony, char = Cree) on prod, hard-refreshed
- Both consoles open (F12) - leave them open through the test
- Live DB cleared to known good: market scene `e8101934` active, `cell_px=205, grid=20x20`, Cree at (1, 1)

---

## Check 1: same scene, same scale

**What to do:** Both tabs land on the market scene. Cree is visible at top-left of the grid (cell (1, 1)).

**PASS criteria:**
- GM and player both see Cree at the same position RELATIVE to the market art (upper-left, by the wagon / stalls / wherever the art shows at cell 1,1)
- Cell sizes look proportionate on both screens (GM narrower window = smaller cells; player wider window = bigger cells - that's fine, but they should be *proportional to viewport*)
- Console on both shows `[TM] auto-fit` at most once each, no `[TM] auto-fit FAILED`

**FAIL clue:** if console shows `[TM] auto-fit FAILED { ... }` on the GM, copy the error - that's RLS or a constraint blocking the write.

---

## Check 2: scene switch propagates

**What to do:** GM dropdown -> click `Scene` (the old graveyard one, id `8fa2523c`).

**PASS criteria:**
- Both tabs switch to the graveyard scene within 2 seconds
- Both see the same art at the same cell positions
- Console: GM shows `[TM] auto-fit` if grid needed re-computing for the new image; no FAILED

**FAIL clue:**
- Player stuck on market = realtime sync dropped. Hard-refresh player tab; re-test.
- Player sees graveyard but at a different scale than GM = the new auto-fit didn't persist for the player to pick up.

---

## Check 3: cell_px doesn't drift

**What to do:** Switch the GM back to the market scene. Both tabs settle. **Don't touch anything for 60 seconds.** Then run in any shell:

```
npx supabase db query --linked "SELECT cell_px, grid_cols, grid_rows FROM tactical_scenes WHERE id = 'e8101934-676f-4892-9804-1ec836f05483';"
```

**PASS criteria:** `cell_px=205, grid_cols=20, grid_rows=20` (unchanged from setup).

**FAIL clue:** if `cell_px` is anything other than 205, something is still writing without user click. That's a regression of the popout race - tell me the new value.

---

## Check 4: + Map re-spawns clean (the un-archive bug)

**What to do:**
1. GM clicks `+ Map` next to Cree's roster row (button currently shows `✓ Map` because Cree is on the map) - this **removes** Cree.
2. GM clicks again - this **places** Cree back.
3. Look at where Cree lands.

**PASS criteria:** Cree appears at or near cell `(1, 1)` (top-left), NOT at the position it was last dragged to in some earlier session.

**FAIL clue:** if Cree shows up at a random cell deep in the map, the un-archive fix isn't on this build (or the deploy hasn't propagated yet). Check `git log origin/main` for `a068ffb`.

---

## Check 5: player centers on own token after init

**What to do:** Player tab hard-refresh ONE more time. Wait for tactical map to render.

**PASS criteria:** player's viewport is centered on Cree (Cree visible in the middle of the player's view, not stranded in a corner or off-screen).

**FAIL clue:** Cree is visible but off-center / in a corner = the `myCharacterId` re-center didn't fire. Check the console for any `[TM]` errors right after refresh.

---

## What "GREEN across 1-5" gets us

The 12-check 2-client gate at [tasks/tactical-map-verify-2client-testplan-2026-05-27.md](tactical-map-verify-2client-testplan-2026-05-27.md) becomes runnable. All-12-pass = TacticalMap Risk Register YELLOW -> GREEN, and #1 KS core-loop reliability closes.

## What "ANY RED" gets you

Reply with the check# + the symptom + the console output. Each fail has a known diagnostic above so I can point to the exact next move without speculation.
