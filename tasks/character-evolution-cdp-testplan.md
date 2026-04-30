# Testplan — Character Evolution / CDP Calculator v1 (2026-04-29)

## What shipped

The spend side of the CDP loop. Players turn earned CDP into RAPID
raises, skill raises, or new-skill learns. The GM-side award flow at
GM Tools ▾ → CDP is unchanged; this is the Calculator's twin on the
spend side.

**Trigger:** purple Evolution button on `<CharacterCard>` (was a
scroll-to-Progression-Log placeholder; now opens the modal). Disabled
when the card has no `liveState` — i.e. when looking at a character
outside a campaign session, where there's no per-campaign CDP balance
to deduct.

**Modal: `<CharacterEvolution>`** — single-screen spend list with:
- Header showing current CDP balance.
- RAPID block (5 attribute rows) with per-row "Raise to N — X CDP"
  button. Disabled when at Lv 4 or insufficient CDP.
- Skills block (28 skills, sorted by current level descending) with
  per-row "Raise to N — X CDP" or "Learn — 1 CDP" button.
- Lv 4 steps (3 → 4) marked with a ⭐ on the button label.

**Confirm overlay** — appears on row click. Lv 4 steps require a
narrative textarea ≥ 12 chars (one full sentence) before Confirm
unlocks. Other steps are single-tap confirm.

**Save flow:**
1. Deduct cost from `character_states.cdp` (per-campaign).
2. Update `characters.data.rapid` or `characters.data.skills`
   (cross-campaign — same character row used across all stories).
3. Append a progression-log entry — `attribute` type for RAPID,
   `skill` type for skills. Lv 4 entries embed the narrative.

## Cost rules (SRD-canonical per `tasks/rules-extract-cdp.md`)

### Skills
| Action | Cost |
|---|---|
| Learn (any baseline → Lv 1) | 1 CDP |
| Raise Lv 1 → Lv 2 | 3 CDP |
| Raise Lv 2 → Lv 3 | 5 CDP |
| Raise Lv 3 → Lv 4 ⭐ | 7 CDP |

### RAPID
| Action | Cost |
|---|---|
| Raise 0 → 1 | 3 CDP |
| Raise 1 → 2 | 6 CDP |
| Raise 2 → 3 | 9 CDP |
| Raise 3 → 4 ⭐ | 12 CDP |

(SRD §07 — 3× the new level. CRB has a copy-paste typo we ignore per
CLAUDE.md precedence rule.)

## Pre-test setup
- An active campaign session, viewing your PC's CharacterCard from
  inside `/stories/[id]/table` (not the standalone /character-sheet
  popout — the modal needs the per-campaign `character_states` row).
- GM has awarded enough CDP to test purchases (use GM Tools ▾ → CDP
  to top up to 10).

## Test cases

### Critical path — happy
1. **Open the modal** — click purple Evolution button on your PC's
   card. Modal opens, header shows your name + current CDP balance.
2. **RAPID raise (in-budget)** — pick an attribute at Lv 1 (e.g. PHY
   1 → 2 = 6 CDP). Click the button. Confirm overlay appears with
   "Spend 6 CDP from your N balance." Click ✓ Confirm. Modal closes.
   Card reflects new RAPID value. CDP balance dropped by 6.
3. **Skill raise (in-budget)** — pick a skill at Lv 2 (e.g. Athletics
   2 → 3 = 5 CDP). Same flow. Card's skill list updates.
4. **Skill learn (vocational)** — pick a vocational skill at -3
   (e.g. Mechanic\* -3 → 1 = 1 CDP). Button reads "Learn — 1 CDP".
   Confirm. New entry appears in your skills array at level 1.
5. **Skill learn (non-vocational)** — pick a non-vocational skill at
   0 (e.g. Athletics if you don't have it). Button reads "Learn — 1
   CDP". Confirm. New entry at level 1.
6. **Progression log entries** — open the Progression Log on your
   card after each spend. Entries:
   - `📈 Physicality Lv 1 → Lv 2 — 6 CDP.`
   - `📈 Athletics Lv 2 → Lv 3 — 5 CDP.`
   - `📈 Learned Mechanic\* (Lv 1) — 1 CDP.`

### Lv 4 narrative gate
7. **Lv 3 → Lv 4 RAPID (e.g. Acumen 3 → 4 = 12 CDP)** — button
   shows `Raise to 4 ⭐ — 12 CDP`. Click. Confirm overlay reads
   "Lv 4 — Fill In The Gaps" (amber border) with a textarea below.
8. **Empty narrative** — click ✓ Confirm with empty/short narrative
   → red error "Lv 4 raises require a Fill-In-The-Gaps narrative —
   at least one full sentence so the GM can read back why the
   breakthrough happened." No spend, no DB write.
9. **Valid narrative** — write a sentence in the textarea. Confirm.
   Spend goes through. Progression log entry includes the quoted
   narrative inline:
   `📈 Acumen Lv 3 → Lv 4 — 12 CDP. "Years on the road have sharpened her instincts past anything I trained her in."`
10. **Lv 3 → Lv 4 skill** — same flow. Confirm overlay's "Lv 4 —
    Fill In The Gaps" appears for skills too. Narrative stored on
    log entry.

### Insufficient CDP
11. **Try to buy something you can't afford** — pick an option whose
    CDP cost > your balance. Button is disabled (greyed, "not-allowed"
    cursor). Clicking does nothing, no confirm overlay opens.
12. **Spend bringing balance below 0** — should be impossible by
    design (button disables when cost > balance). Verify no clever
    way to overspend (e.g. queueing two confirms — the modal is
    single-spend so clicking the next row immediately replaces the
    pending state).

### Edge cases
13. **Already at Lv 4** — button replaced with the cap label
    ("Human Peak" for RAPID, "Life's Work" for skills). No click target.
14. **No live state** — Evolution button on the card is disabled +
    tooltip reads "Open Evolution from inside a campaign session…"
    (e.g. viewing your PC from /characters or another out-of-session
    surface).
15. **ESC key** — pressing ESC with the spend list open closes the
    modal. Pressing ESC with the confirm overlay open closes the
    confirm overlay (returns to the spend list). Pressing ESC mid-
    save does nothing (saving is locked).
16. **Backdrop click** — clicking outside the modal closes it
    (when no confirm or save is in progress). Backdrop click on the
    confirm overlay closes the overlay.
17. **Cross-campaign reflection** — spend on Character X in Campaign
    A, then open Character X's sheet in Campaign B. The new RAPID /
    skills are visible (because they're stored on the cross-campaign
    `characters` row). CDP balance does NOT carry — that's per
    `character_states`.
18. **Concurrent edits** — open the modal in two tabs simultaneously,
    spend in both. Last write wins on `characters.data` (read-modify-
    write pattern). Acceptable for v1; UI doesn't surface a warning
    yet. CDP race is mitigated by the single-spend confirm flow —
    you have to commit one before clicking another.

### Visual + UX
19. **Sort order on skills** — skills sorted by current level
    descending. Standout skills (Lv 3+) at the top, untrained skills
    cluster at the bottom. Alphabetical within a tier.
20. **Lv 4 button styling** — bold + ⭐ on rows that would step into
    Lv 4. Rest are normal weight.
21. **Cancel mid-confirm** — clicking Cancel on the confirm overlay
    returns to the spend list with no DB write. Pending state cleared.
22. **Card re-render after spend** — RAPID values + skill levels +
    CDP balance all visibly update on the card without a manual
    refresh. (Realtime on `character_states` triggers loadEntries;
    the cross-campaign `characters` row may need a manual refetch
    in a follow-up if the realtime channel doesn't cover it.)

## Files touched
- `lib/cdp-costs.ts` — pure cost-formula helpers.
- `components/CharacterEvolution.tsx` — the modal.
- `components/CharacterCard.tsx` — wires the Evolution button +
  mounts the modal.

## SQL migrations
None. CDP balance + character data already on existing tables.

## Out of scope (deferred to v2 per `rules-extract-cdp.md` §8)
- Apprentice routing (spend on master PC's Apprentice instead of
  self) — closes one of the §2a follow-ups.
- Reusing PC's earned CDP on the Apprentice — same blocker.
- Per-Trait UI at Lv 4 — gated on the full Lv 4 Skill Trait list
  (memory:project_lv4_traits backburner).
- Formal GM-approval pipeline for Lv 4 (currently just the narrative
  textarea; no submit/approve/reject states).
- History tab inside the modal — Progression Log on the card already
  shows attribute / skill entries with filtering chips. Adding a
  duplicate inside the modal would be redundant for v1.

## Rollback
Single commit. Two new files (`lib/cdp-costs.ts`,
`components/CharacterEvolution.tsx`) plus a small CharacterCard.tsx
edit. `git revert` cleanly removes the modal; existing characters'
`data.rapid` and `data.skills` and `progression_log` entries written
through the Calculator persist harmlessly.
