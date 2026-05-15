# Polish Pass Test Plan — 2026-05-14

Tests for the four-bundle polish pass (DB migrations + prose fixes +
Thriver godmode widening + CampaignObjects "found nothing"). Plus the
larger mechanics shipped earlier in the same session (Coordinated
Effort, Healing on Time-Tick, Weapon Repair, Year-0 calendar, Campaign
Sheet clock header).

Run on `thetapestry.distemperverse.com` after the Vercel deploy lands.

---

## Pre-flight (do once, before each section)

1. Hard-refresh the relevant tab (Ctrl+Shift+R).
2. Open the browser DevTools Console to catch any `console.warn` /
   `console.error` output the new code emits.

---

## Bundle 1 — DB migrations applied

### 1.1  `sql/initiative-order-rls-members-write.sql` — Nana attack bug

**What this fixes:** Cover Fire / Inspire / Distract used to silently
fail when the GM ran the action as a non-owning player (RLS blocked the
write to `initiative_order`).

1. Log in as a non-GM PLAYER in a combat-active campaign.
2. Have your PC use **Cover Fire** on an enemy. Confirm:
   - Roll resolves.
   - The target gets the -2 CMod on their next attack.
   - DevTools console: no `SILENT RLS FAIL - Cover Fire aim_bonus`
     warning.
3. Have your PC use **Inspire** on an ally. Confirm:
   - The ally gets +1 Combat Action.
   - No `SILENT RLS FAIL - Inspire actions_remaining` warning.
4. Have your PC use **Distract** on an enemy. Confirm:
   - The target loses 1-2 actions per the Opposed-check outcome.
   - No `SILENT RLS FAIL - target actions_remaining` warning.

**Pass condition:** all three actions land their downstream effect on a
non-GM-owned PC's turn.

### 1.2  `sql/player-notes-session-tag.sql` — player notes session-scoped

**What this fixes:** Player notes from prior sessions weren't tagged
with a session id, so they'd carry forward forever.

1. Open the table page. Open the **Notes** tab (player side, not GM).
2. Submit a player note.
3. End the session (GM action).
4. Start a new session.
5. Confirm: the previous session's player note is NOT shown in the
   active session's notes panel.

**Pass condition:** prior-session notes don't leak into the new session.

---

## Bundle 2 — Prose fixes

### 2.1  Insight Dice on Death wording

1. Navigate to `/rules/core-mechanics/insight-dice`.
2. Look at the bullet about saving the character from Death.
3. Confirm the wording reads "**1 Wound Point + 1 Resilience Point
   (total, regardless of how many dice were surrendered)**" - NOT "per
   die".

### 2.2  Subsistence Damage grace period

1. Navigate to `/rules/combat/damage`, scroll to "Subsistence Damage".
2. Confirm the prose says "a **two-day grace period** (days 1 and 2
   hungry, no damage). Starting on day 3 of hunger, they lose 1 WP and
   1 RP per day".
3. Confirm the Insight-Die-stave-off paragraph is present.

### 2.3  Canon doc regenerated

1. Open `tasks/tapestry-rules-canon.md` in the repo.
2. Header reads "Generated: 2026-05-14".
3. Search for "1 Wound Point + 1 Resilience Point total" - found.
4. Search for "per die surrendered" - NOT found.

---

## Bundle 3 — Thriver godmode widening

**Setup:** you'll need a SECOND account with `role='thriver'` (the
account you mentioned setting up earlier). Log in as that account.

### 3.1  Community Dashboard at `/stories/<id>/community`

1. Navigate to a campaign you do NOT own as GM.
2. Open the Community Dashboard URL directly.
3. Confirm: the dashboard loads instead of showing "GM Only".
4. The "GM Only" gate copy now mentions "(or a Thriver)" if you see it.

### 3.2  Vehicle popout at `/vehicle?c=<campaignId>&v=<vehicleId>`

1. Open a vehicle popout on a campaign you don't own.
2. Confirm Thrivers see edit affordances (cargo add/remove, fuel
   adjust, notes edit) that a non-GM-non-Thriver wouldn't.

### 3.3  Regression check — non-Thriver non-GM stays gated

1. Log in as a Survivor or Ghost account (or just a player who isn't
   the campaign's GM).
2. Open the Community Dashboard. Confirm "GM Only" gate fires.
3. Open the Vehicle popout. Confirm no edit affordances.

---

## Bundle 4 — CampaignObjects "found nothing"

### 4.1  Search button on empty destroyed container

1. Open a campaign with at least one destroyed object that's been
   looted dry (or place a fresh object on the map and reduce its WP
   to 0 to destroy it, contents empty by default).
2. Open the Objects sidebar (the panel listing campaign objects).
3. Find the destroyed-empty object in the list. Confirm:
   - A **Search** button appears next to the object name.
   - No "Loot" button (that's only for non-empty destroyed).
4. Click Search. The loot modal opens.
5. Modal body shows: "Nothing left inside." + "Who's searching?"
   dropdown + "Confirm Search" button.
6. Pick a PC from the dropdown.
7. Click "Confirm Search (log 'found nothing')".
8. Confirm:
   - Modal closes.
   - Feed row appears: `🎒 <PC name> looked through the remains of
     <object> and found nothing`.

---

## Pre-existing mechanics (also shipped this session — re-test)

### 5.1  Coordinated Effort end-to-end (from `tasks/spec-coordinated-effort.md`)

1. Header bar → **Checks** menu → **Coordinated Effort**.
2. Pick first skill (any), check 2+ participants (you + at least one
   other PC).
3. Click "Start Effort - You Roll First".
4. Roll modal opens with the CMod input pre-baked to +N (one per
   other participant).
5. Confirm the dice. Outcome resolves.
6. After the roll:
   - On Success/WS/HI: a green **🤝 Coordinated Effort active** banner
     appears below the main header. It reads `+N (coord) + Y (lead) =
     Z CMod`.
   - On Low Insight: NO banner appears (chain aborts).
7. While the banner is up, have another participating PC fire any roll
   (skill check, attack, whatever).
8. Confirm: the CMod input pre-fills with `N + Y` (coord + lead).
9. Click **End Effort** on the banner.
10. Confirm banner disappears.

### 5.2  Healing on Time-Tick (from `tasks/spec-healing.md`)

1. Header bar → **Checks** → **Heal**.
2. Pick a target. Pick a kit (Naked / First Aid Kit if owned /
   Doctor's Bag if owned).
3. Click "Roll Medicine* on Target".
4. Roll. On Success+: the modal shows "Queued +N WP over 24h (50% at
   +12h, 50% at +24h)" in the result.
5. Open the Campaign Sheet. Open **Advance Time** modal. Advance by
   12 hours.
6. Confirm a System feed row lands: `🩹 Treatment applied: <target>
   (+X WP, Y to Z)`.
7. Advance by another 12 hours.
8. Confirm the second System row lands with the remainder.

**Negative tests:**
- Roll Dire Failure (use GM Dev Tools if needed): target loses 1 WP
  immediately, no queue.
- Roll Low Insight: feed prompts a Wound Infection check; healer earns
  +1 Insight Die.

### 5.3  Weapon Repair (Repair button on melee)

1. Get any PC's primary weapon into a "needs repair" state — easiest:
   roll a Low Insight attack with a melee weapon (intentionally low
   AMod/SMod and stack -CMod to make it likely) to jam it AND drop
   condition.
2. Open the Ready Weapon modal.
3. With a MELEE weapon equipped: button reads **Repair** (not Unjam).
4. With a FIREARM equipped: button reads **Unjam**.
5. Click the button. Roll resolves with skill candidates: Tinkerer /
   Weaponsmith\* / (Melee Combat OR Ranged Combat per weapon type).
6. On Success: weapon condition improves, jam clears.
7. On Wild Success: condition improves by 1 level even if not Worn.
8. On Dire Failure: weapon jumps to Broken.

### 5.4  Year-0 calendar in /stories/new and module editor

1. Visit `/stories/new`. Pick **Custom Setting**.
2. Confirm Campaign Start Date controls render above Starting Location:
   Month dropdown / Day dropdown / Year dropdown (Year 0 through 20).
3. Pick Year 0, March 2nd. Confirm the live readout says "the day the
   pandemic was declared".
4. Pick Year 0, January 1st. Confirm: "60 days before the first
   recorded death".
5. Pick Year 1, March 2nd. Confirm: "365 days since the first recorded
   death".
6. Open the module editor for any module you own. Confirm: same three
   dropdowns appear between Sort Order and Save Changes.

### 5.5  Campaign Sheet clock header + GM edit

1. Open the Campaign Sheet on a campaign where you're the GM.
2. Header line should read:
   ```
   Campaign Day N · <hour> AM/PM, <Month> <day>th, Year M · <X> days
   after the first recorded death
   ```
3. Click the **Edit** button next to the header.
4. Modal opens with current Date / Time + Campaign Start Date pickers.
5. Change something. Save.
6. Header re-renders with the new date.

### 5.6  Die3 in expanded roll log

1. Spend a 3d6 Insight Die on any roll (Roll 3d6 button in the pre-roll
   Insight section).
2. After resolve, click ▸ on the resulting feed row.
3. Confirm the math line reads `[d1+d2+d3 (insight die)] +AMod +SMod +CMod
   = total Outcome` - NOT the legacy `[d1 + (d2+d3) (d2+d3)]`.
4. Below the math line: "Insight Die spent to pre-roll 3d6 and keep
   all 3".
5. For a +3 CMod spend: row should show "Insight Die spent - +3 CMod"
   and inline the `(insight die)` label on the CMod chunk.

---

### 5.7  Export Session Log

1. On the table page, click **End Session** button to open the End
   Session modal.
2. Confirm: a green **Export Log** button appears between Cancel
   and End Session.
3. Click Export Log. A file should download named
   `<campaign-slug>-session-<N>-<YYYY-MM-DD>.html`.
4. Open the downloaded file in a browser. Confirm:
   - Title reads "<Campaign Name> - Session N Log".
   - Each row shows name + time + narrative + (dice math if applicable).
   - HI/LI rows have the green `+1 Insight Die` badge.
   - WS / Success / Failure / DF rows have NO badge.
   - 3d6 insight spends show `[d1+d2+d3 (insight die)]` and the
     "Insight Die spent to pre-roll 3d6 and keep all 3" subline.
   - Bordered colors per outcome (green / blue / amber / red).
5. Close the End Session modal without ending.
6. Open the Campaign Sheet. Click the **Export Log** button next to
   the Edit Clock button. Same file downloads (named with sessionNumber=0
   if not actively in a session - cosmetic only).

## Smoke checks (do these whenever you have a tab open)

- Feed never renders a `+1 Insight Die` badge on Success / Wild Success
  / Dire Failure outcomes. ONLY on HI / LI.
- Feed never renders the literal string "Live feed adds Insight Die
  badge on HI/LI..." anywhere.
- Group Check banner never renders the badge on Success outcomes.
- Online indicator (green ring on avatars) appears for players currently
  on the table page and dims within ~30s of them closing the tab.

---

## Known caveats / out-of-scope

- The Wound Infection check on a Healing Low Insight is currently a
  feed prompt only — actual check resolution is GM-driven (no auto-
  trigger).
- Kit consumption (First Aid Kit / Doctor's Bag have no charges
  tracked) — canon doesn't specify, treated as infinite-use for now.
- Per-participant opt-out for Coordinated Effort — current UI only has
  "End Effort" (terminates whole chain). Per-participant opt-out is in
  the spec but not built.
- Bespoke summary banner for Coordinated Effort feed — currently each
  roll in the chain shows up as its own row. Summary banner deferred.
- The `dayToCalendar` strict-Gregorian math returns September 17th for
  canon_day 564 (you said September 15th in your example). The
  comment in `lib/distemper-timeline.ts` notes some Year 2+ event days
  in the canon table are +1 vs strict math. Not a bug, just a known
  rounding split. Revisit if cosmetic mismatch matters.
