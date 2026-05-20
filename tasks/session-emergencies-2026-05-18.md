# Session Emergencies - 2026-05-18

In-session breakage cheatsheet. Keep this open in a side tab during
play. Listed by symptom.

---

## Player can't take their turn / turn stuck on one player

**Likely:** initiative state machine (YELLOW in
[debug-handoff.md](debug-handoff.md) §1).

**First moves:**
1. Have the player hard-refresh (Ctrl+Shift+R).
2. If still stuck, you (as GM) can force-advance via the initiative
   tracker UI.
3. If turn order is genuinely broken: `actions_remaining` may have
   desynced. Bump them via the GM console action.
4. **File a bug** with: player name, NPC/PC on the active slot, what
   action they tried, what happened. Don't try to fix code live.

---

## Feed row looks wrong (wrong color, wrong label, missing)

**Likely:** RollOutcome migration (YELLOW in §1). 49 insert sites
were migrated 2026-05-15; smoke test passed but feed-rendering bugs
are subtle.

**First moves:**
1. Note the exact row text + what you expected.
2. Screenshot the feed area.
3. Check browser console for any `console.warn` referencing
   `roll_log` or `outcome`.
4. **File a bug** - include the screenshot + the action that produced
   the row.

---

## Vehicle / token / map render bug

**Likely:** TacticalMap canvas (YELLOW in §1).

**First moves:**
1. Player hard-refresh first.
2. If fog or token state is wrong: GM can toggle the scene off/on
   to force a re-render.
3. If a token is in the wrong cell: GM can manually drag it back -
   the drag-end fix (`d2ba6b6`) lands on the correct cell now.
4. **File a bug** with: scene name, token name, what cell vs what
   cell expected.

---

## Realtime desync (GM moves a token, player doesn't see)

**Likely:** Supabase broadcast channel dropped.

**First moves:**
1. Player hard-refresh - re-subscribes to the channel.
2. If GM also affected, GM refreshes too.
3. If persists across refreshes: Supabase might be having an outage.
   Check https://status.supabase.com.
4. **File a bug** with: timestamp, action that didn't propagate,
   how many clients affected.

---

## A modal won't close / a button does nothing

**Likely:** stuck React state.

**First moves:**
1. Hard-refresh the affected client.
2. If reproducible on refresh: it's a real bug, not transient.
3. **File a bug** with: exact button / modal, browser, what you
   expected the button to do.

---

## Sentry should have caught it, but I see nothing in the dashboard

**Verify pipeline is alive:**
1. F12 → Network tab → filter `monitoring`
2. Take an action you expect to error
3. Watch for new POST to `/monitoring?o=...&p=...&r=us`
4. Status 200 = pipeline alive, event sent. Dashboard may lag ≤60s.
5. Status non-2xx = tunnel / config broken. Pause the session, ping
   Claude post-session for diagnosis.

If pipeline is alive but errors aren't appearing: likely Sentry's
`InboundFilters` ate it (DevTools-injected throws are filtered
by-design). Real app errors should land.

---

## The 15-minute rule

If a bug is implicated to a recent change and the fix isn't obvious
in 15 minutes, **revert first, investigate second** (per
[debug-handoff.md](debug-handoff.md) §4 step 5).

The revert command is in the commit's chat block (search Claude
transcript for the commit hash).

But: during a live playtest session, **don't revert anything**. The
15-min rule is for post-session triage. Live, the only move is "file
a bug + work around it."

---

## Recovery moves you have RIGHT NOW (no code change needed)

- **🚨 HIDE ALL** on NPC roster → nukes all NPC visibility in one click
- **Show/Hide toggle** on roster → bulk flip
- **GM force-reveal NPC** → individual reveal via NPC card
- **Scene off/on toggle** → forces map re-render on all clients
- **Hard-refresh** → fixes 70% of "weird" state issues
- **Drag-and-drop initiative tracker** → re-order turns if logic
  glitches
- **Manual `actions_remaining` bump** → unstick a turn
- **GM time-tick** → advance the campaign clock if drainers are stuck

---

## Post-session

1. Capture every bug as a bug report (don't rely on memory).
2. Run `git log --oneline --since="6 hours ago"` to see what was live
   during the session.
3. Drop a session summary in `tasks/handoff.md` - wins + breaks +
   open questions.
4. If something broke in a load-bearing area (campaign-clock,
   initiative, roll_log, TacticalMap), flag it RED in
   [debug-handoff.md](debug-handoff.md) §1 before going to bed.
