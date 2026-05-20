# Session Prep — 2026-05-25

What's new at the table since 2026-05-18 playtest. Skim 5 min before kickoff. Focus on "things you should NOT see" — those are your tripwires for "this is broken" vs "this is the new behavior."

---

## Behavioral changes (you might mistake these for bugs if you forget)

### Recruit Tier-2 — three new behaviors

Schema migration shipped, `community_members` + `campaign_npcs` got new columns. Side effects you'll notice at the table:

- **Temporary recruits.** Plain Success on Cohort/Conscript/Convert now creates a temporary member with a **blue "⏳ Temporary" chip** in the community roster. They drop automatically at the next Morale Check. Wild Success / High Insight remain permanent.
- **Conscript Failures still "join."** Conscript Failure (any tier) now writes the membership row with an amber **"⏳ Escape Pending"** chip. GM-only **🏃 Fire Escape** button appears next to the × remove button. Fire the escape when the story justifies (next scene change, downtime, when the party is distracted, etc.).
- **Convert + Intimidation Failure locks the approach.** If a PC fails a Convert attempt while using Intimidation, that NPC can never be Convert-recruited again (any PC, any future attempt). The Recruit modal greys out Convert with a 🔒 + tooltip explanation. Cohort + Conscript still selectable.

### Stress Check cascade

The CHECK button on the stress bar now fires the canonical mid-play check. Success = no change; Failure = +1 stress. If the +1 fills the bar to 5, the at-max modal opens automatically right after.

- **Mid-play check** narrative reads `STRESS CHECK <name> feels the weight` on failure, `holds steady against the pressure` on success.
- **At-max check** reads `STRESS CHECK <name> calms themselves down` on success → drops to 4; `fails to calm and reaches their Breaking Point` on failure → Breaking Point modal.

If you click CHECK at stress 4 and fail, watch for two modals firing in sequence — that's correct.

### Gut Instinct GM whisper

When a player resolves a Gut Instinct roll, the standard feed narrative lands for everyone. **Then your screen gets an amber-bordered modal** auto-opening, prompting you to whisper a private detail to the player. Two buttons: **Send Whisper** (delivers it as a private chat message) or **Skip** (player sees only the feed line).

- Player will auto-flip to their Chat tab when the whisper arrives.
- Self-roll edge case: if YOU as GM rolled Gut Instinct on your own PC, the modal does NOT auto-open (no point whispering to yourself).

### Tactical Map Share View

New **👁 Share View** button top-right of the tactical map, GM-only. Mirrors the campaign-map's version. Click → broadcasts your current scroll position + zoom + asset scale to every player. Their map smooth-scrolls to match. Button flashes green `✓ Shared` for 1.5s.

- **Not a continuous follow mode.** One-shot push. Players can keep panning after.
- Use it when you want to draw everyone's eye to a specific area or pull them out of the weeds and back to the action.

### Narrative polish — 15 branches reworked

Every check/action narrative got polished today. Don't be surprised by the new wording — it's not a bug, it's the new canon. Key changes:
- **Prefix tags** on most check types: `ATTRIBUTE CHECK`, `STRESS CHECK`, `STABILIZE`, `HEAL`, `UNJAM`, `REPAIR`, `COORDINATED EFFORT`.
- **No prefix** on Recruit, First Impression, Distract, Vehicle Attack/Driving/Brew, Group Check (deliberate — those have richer narrative bodies).
- **Mechanical bits banned in compact narrative.** Things like `(+1 stress)`, `(-2 CMod)`, `(+1 action)` are GONE from feed lines. Still visible in expanded ▸ view + on the affected character's pips. Story first, numbers second.
- **HI tail always reads** `and has a Moment of Insight as to why it went so well`. **LI tail always reads** `but has a Moment of Insight as to why it went so badly`. Symmetric long form.

### Player bar (GM screen)

PCs whose players are **currently online** sit closest to your card. Offline PCs trail. Reorders live as players join/leave (no refresh needed).

### Coord Effort summary banner

Chains of N participants now collapse into a single banner row in the feed. Individual participant rolls visible in the expanded ▸ view. Withdraw chip on the banner still works the same way.

---

## Things you should NOT see during the session

If you see any of these, file a bug — they were validated in the smoke test, so they're regressions:

- Recruit modal allowing Convert approach on an NPC that has it locked (button should be greyed out + 🔒)
- Plain Success recruits with NO Temporary chip (should always chip)
- Conscript Failure with NO Escape Pending chip
- Morale check that doesn't drop temporary members
- Gut Instinct roll where the GM modal doesn't auto-open on a remote player's roll
- Stress at 4, click CHECK, fail → stress goes to 5 but the at-max modal doesn't fire
- Tactical Share View button missing on the GM's tactical map
- Mechanical bits like `(+1 stress)` in any compact narrative feed row
- Em-dashes anywhere (we swept them today; project rule)

---

## Quick-reference: locked rules

- **HI tail:** `and has a Moment of Insight as to why it went so well`
- **LI tail:** `but has a Moment of Insight as to why it went so badly`
- **WS tag:** `and was wildly successful`
- **DF tag:** `and failed miserably`
- **Stabilize HI bespoke:** `and has a Moment of Insight while doing so` (intentional carve-out)
- **First Impression HI bespoke:** `and has a Moment of Insight as to why they did so well` (intentional carve-out)
- **First Impression LI bespoke:** `but has a Moment of Insight as to what went wrong` (intentional carve-out)

---

## Sentry status

Last verified alive 2026-05-18. Tunnel returns 200; SDK loaded. If something throws unexpectedly during the session, it should land in https://xero-sum-games.sentry.io/issues — check post-session for anything you didn't notice live.

---

## Stand-down

Don't ship anything from now until post-playtest. SRE rule: no load-bearing changes inside the playtest window. If a player reports something mid-session, capture via bug report — don't try to fix it live.
