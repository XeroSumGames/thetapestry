# Beta-500 dry-run playtest plan - 2026-06-11

**Purpose:** ensure the 4 HOPED-FOR (shipped + typechecked but not
yet playtested) systems get a confirmed real-world hit before
Beta-500 opens 2026-07-01. After this dry-run, the Confidence Ledger
in [tasks/debug-handoff.md](debug-handoff.md) Section 3 should be
able to demote all 4 from HOPED-FOR to PLAYTESTED RECENTLY.

**Window:** anytime between today and 2026-06-30.
**Format:** one 2-3 hour Xero + kids session (or split across two
shorter sessions) on a fresh test campaign or an existing one
where these surfaces fit narratively.
**Recorder:** ON for the full duration (chrome ⏺ button in the
sidebar - the post-vacation chrome-record feature means it'll stay
on across all routes).

---

## The 4 systems to exercise

### 1. Tier-2 Recruit

**What it is:** community-flow recruiting mechanic (Phase A approach
flags + Phase B morale-tick drainer + Escape Pending + Phase C modal
locked-approach gates).

**Dry-run trigger (one of):**
- A PC in a community attempts to Recruit a new member - opens the
  Recruit modal, picks an approach (Charm / Coerce / Negotiate /
  Inspire / etc.), rolls.
- OR a PC attempts to Recruit a member who's currently part of a
  RIVAL community - the poaching-penalty gate should fire.
- OR run the morale-tick drainer by advancing the campaign clock
  enough to cross a community's morale checkpoint and watch the
  Recruit flow get gated by low morale.

**What to watch:**
- Approach lock-gates appear correctly per the community's locked
  approaches.
- The roll fires through the standard roll flow (action consumed,
  CMod applied, feed row written).
- Poaching penalty (if rival source) shows up on the roll-modal
  CMod stack.
- On Success: new member appears in the community roster; feed row
  describes the outcome.
- On Failure: feed row narrates the rebuff; no roster change.

**Where to look for breakage:**
- [components/CommunityProxyRecruitModal.tsx](components/CommunityProxyRecruitModal.tsx) -
  the modal UI.
- Roll-log row should have `outcome` reflecting the recruit result.
- `community_members` table should grow by 1 on Success.

---

### 2. Advantages (P3 Q4-b)

**What it is:** the Advantages system - GM grants an Advantage to
a PC, player sees it in their tab, uses it via the Use button at
roll time, an Award-on-feed line fires, C3 broadcast lands.

**Dry-run trigger:**
- GM opens a PC's sheet, navigates to the Advantages tab (or
  wherever the grant dialog lives), grants an Advantage by category
  + label (e.g., "Quick Reflexes" / "Tough" / a setting-flavored one).
- Player opens their sheet, confirms the Advantage appears.
- Player rolls anything where the Advantage applies + clicks Use.
- Feed row writes "Player used [Advantage Name]" or similar.
- C3 broadcast lands on the GM's screen (the GM sees it consumed in
  realtime).

**What to watch:**
- Grant dialog opens, the Advantage library populates (the canon
  list of grantable Advantages).
- Granted Advantage persists across page refresh (it's in the DB,
  not just local state).
- Use button consumes the Advantage (one-shot, or per-rest, depending
  on its definition).
- Award-on-feed row visible to all clients.

**Where to look:**
- The Advantages library lives in [lib/advantages.ts](lib/advantages.ts)
  (or whichever lib).
- Grant dialog probably on the character sheet or popout.
- Use button on the RollModal preRollExtras.

---

### 3. First Impression streamline

**What it is:** the unified First Impression flow (Phase 1 pure-helper
extraction + Phase 2 single-modal flow + Phase 3 Insight Die spend +
cutover). Heal-LI infection cascade has been exercised, but the
*Insight Die spend + single-modal* path has not been hit at a
multi-player table.

**Dry-run trigger:**
- A PC encounters a new NPC (or initiates a social interaction with a
  campaign NPC they haven't introduced themselves to yet).
- PC clicks "First Impression" - the single-modal flow opens.
- Roll proceeds through the standard outcome ladder.
- On Low Insight or High Insight, the Insight Die spend path is
  offered.
- Player either spends or declines the Insight Die.
- Outcome applies + feed row writes.

**What to watch:**
- The modal is SINGLE (not the old multi-step flow) - one open, roll,
  done.
- Insight Die offer appears on LI / HI outcomes only.
- Spending an Insight Die actually decrements `character_states`
  insight_dice and applies the bonus to the result.
- Declining preserves the Insight Die.

**Where to look:**
- [lib/first-impression-resolver.ts](lib/first-impression-resolver.ts) +
  tests/lib/first-impression-resolver.test.ts.
- The single-modal flow is on the table page; search for
  `setShowSpecialCheck('first_impression'` or similar.

---

### 4. Stress Check 12-string narrative locks

**What it is:** 12 narrative strings across HEAL / UNJAM / REPAIR /
Stabilize / Gut Instinct / Group Check / First Impression / DRIVE /
BREW / NAVIGATE + the 2 stress page surfaces. The strings are
unit-tested + the locks are typed, but the 12 haven't been seen as
a coherent set at a live table.

**Dry-run trigger - run rolls that cover as many of the 12 surfaces
as practical:**
- HEAL: Medicine\* check at the table (combat or peace).
- UNJAM: jam a firearm (Dire Failure with a weapon) then run the
  Unjam recovery.
- REPAIR: a melee weapon breaks (Dire Failure with a melee weapon)
  then run the Repair recovery.
- Stabilize: drop a PC to 0 WP and have another PC Stabilize via
  Medicine\*.
- Gut Instinct: trigger one (the GM throws a Gut Instinct roll for
  a character).
- Group Check: a multi-character group roll (e.g., Stealth across
  the party).
- First Impression: covered in #3 above.
- DRIVE / BREW / NAVIGATE: vehicle subsystem - drive the truck,
  brew supplies, navigate a route. These are part of the vehicle
  popout flow.

**What to watch:**
- Each surface emits its own narrative string in the feed (not a
  generic "rolled X" line).
- Narratives match the 12-string canon set from `lib/roll-helpers.ts`.
- High Insight / Low Insight narratives are flavored per the surface
  (HEAL HI is different from REPAIR HI).

**Where to look:**
- [lib/roll-helpers.ts](lib/roll-helpers.ts) `narratorRowFor`
  function - the 12-string ladder lives there.
- Roll-feed-log-preview.html mirrors the locked rows; verify the
  live feed matches the preview.

---

## Coverage scoreboard (Xero fills in as systems get hit)

- [ ] **Tier-2 Recruit** - at least one Recruit attempt with at least
  one of the approach gates / poaching penalty / morale-tick firing.
- [ ] **Advantages** - at least one Grant + at least one Use, both
  visible cross-client.
- [ ] **First Impression streamline** - at least one FI roll WITH
  an Insight Die spend or decline.
- [ ] **Stress narratives** - at least 6 of the 12 surfaces hit
  in one session (HEAL / UNJAM / REPAIR / Stabilize / Gut / Group
  / FI / DRIVE / BREW / NAVIGATE).

When all 4 boxes are checked, the Confidence Ledger drains.

---

## What to do after the session

1. **Dump the recorder** on all clients (GM + every player). Saves
   to Downloads with timestamp.
2. **Tell Puffer** the session ran + which boxes hit.
3. Puffer will:
   - Read the recorder dumps + roll_log evidence.
   - Demote the 4 items in [tasks/debug-handoff.md](debug-handoff.md)
     Section 3 from HOPED-FOR to PLAYTESTED RECENTLY.
   - Update [tasks/end-of-the-beginning.md](end-of-the-beginning.md)
     validated-state list.
   - File any findings against the systems as discovered.

After this drain, the only HOPED-FOR risk going into Beta-500 is
whatever bubbles up during the actual 500-user beta - which is the
right risk profile for an open beta.

---

## Why this matters

The pulse has been flagging "4 HOPED-FOR >21d unplaytested" for 23
days straight (runs 46 -> 67). Verifying today: those 4 are correctly
tracked, not drift-noise. The cure is a real session that exercises
them - not a doc-side flip. This testplan is the path to that
session.

If the dry-run finds bugs, GREAT - we have 19 days to fix them
before Beta-500. Catching them on a fresh test playthrough is
ALWAYS cheaper than catching them on a real-user beta.
