# Testplan — Progression Log curation pass (2026-04-29)

## What changed

The Progression Log on a character's sheet is now a curated permanent
journal of memorable life events — no more session-tick or Insight Die
spend noise.

**Cuts (no longer auto-logged):**
- Session N began / Session N ended
- All six Insight Die variants:
  - Spent 1 Insight Die — rolled 3d6 on `<roll>`
  - Spent 1 Insight Die — +3 CMod on `<roll>`
  - Gained 1 Insight Die from Moment of High/Low Insight
  - Spent N Insight Die(s) — reroll both/die1/die2
  - Spent 1 Insight Die — rolled 3d6 on Grapple
  - Spent 1 Insight Die — +3 CMod on Grapple

**Adds (new auto-log hooks):**
- 💀 Died (PC final death — when death countdown hits 0)
- 🩸 Stabilized by `<medic>` (PC stabilize success)
- 🩸 Lasting Wound: `<name>` (CharacterCard PHY-check failure → Table 12)
- ⚡ Breaking Point: `<name>` (`<N>`h) (CharacterCard Stress Check failure → Table 13)
- Met `<NPC>` — `<vibe>` (CMod ±N) (First Impression outcome)
- 🤝 Recruited `<NPC>` as `<approach>` to `<community>` (recruiter PC)
- ⭐ Took `<NPC>` as your Apprentice (master PC, after Take-Apprentice click)
- 🏛️ Founded `<community>` (leader) (community creator PC)
- 🏛️ Joined `<community>` (PC on approval / manual add)
- 🏛️ Left `<community>` (PC on remove / self-leave)
- 🏛️ Became leader of `<community>` (new PC leader)
- 📍 Dropped a pin: "`<title>`" (`<category>`) (PC who saved a pin via QuickAddModal)

**Schema changes (additive only, back-compat):**
- `LogEntry['type']` extended to include `community | pin | relationship`
- `TYPE_COLORS` + `TYPE_LABELS` get matching entries
- Old `session` and `insight` types remain in the schema so existing rows
  in the wild render correctly; they're just no longer auto-written

**Architectural change:**
- Helper extracted to `lib/progression-log.ts` (`appendProgressionEntry`)
  so CampaignCommunity, QuickAddModal, CampaignMap, CharacterCard, and
  the table page all use the same read-modify-write helper.
- `app/stories/[id]/table/page.tsx` keeps a thin wrapper named
  `appendProgressionLog` that delegates — existing call sites untouched.

## Memory rule saved

`feedback_progression_log_curation.md` — the bar is "would a player want
a permanent bookmark for this 5 sessions later?" Combat math + dice
economy → roll_log; durable life events → progression_log.

## Test cases

### Cuts (verify they no longer log)
1. **Start a session** → open the GM's PC sheet → expand Progression Log → no
   "Session N began" entry appended.
2. **End a session** → same → no "Session N ended" entry.
3. **Pre-roll 3d6 Insight Die** on any attack/skill roll → resolve → no
   "Spent 1 Insight Die — rolled 3d6 on …" entry appended.
4. **Pre-roll +3 CMod Insight Die** → resolve → no "+3 CMod on …" entry.
5. **Roll a Moment of High Insight** (sixes) → no "Gained 1 Insight Die
   from Moment of High Insight" entry.
6. **Post-roll reroll Die 1 / Die 2 / Both** → no "Spent N Insight
   Dice — reroll …" entry.
7. **Grapple with 3d6 or +3 CMod Insight pre-roll** → no Grapple Insight
   entry.

### Adds — combat path
8. **PC dies (final)** — drop a PC to mortally wounded, let death_countdown
   tick to 0 over rounds → progression log gets "💀 Died." entry. (System
   broadcasts the existing "💀 X has died." roll_log row too — both fire.)
9. **PC stabilized** — another PC succeeds on a Stabilize check on the
   mortally-wounded PC → the wounded PC's log gets "🩸 Stabilized by `<medic>`."
   The stabilizing PC does NOT get an entry (their roll is in roll_log).
10. **NPC stabilized** — same flow on an NPC → no entry on anyone's log
    (NPCs don't have progression_log).
11. **Lasting Wound failure path** — on a mortally-wounded PC click "Lasting
    Wound Check"; if PHY check fails (total < 9) → modal shows wound;
    progression log gets "🩸 Lasting Wound: `<wound name>`." On PHY success
    → no entry (no wound).
12. **Breaking Point** — let stress hit 5, fail Stress Check, click "Roll on
    Breaking Point Table" → modal shows result; progression log gets
    "⚡ Breaking Point: `<name>` (`<N>`h)." On Stress Check success →
    no entry (held it together).

### Adds — social / relationship
13. **First Impression** — roll First Impression on a revealed NPC →
    progression log on the rolling PC gets "Met `<NPC>` — `<vibe>` (CMod ±N)."
    Vibe is "great first impression" / "good …" / "neutral …" / "rough start" /
    "bad blood" depending on outcome. The CMod magnitude matches the rule.
14. **Re-rolling First Impression** — roll a second First Impression on the
    same NPC → PC's log gets a NEW entry (overwrites in `npc_relationships`,
    but the journal preserves both moments).

### Adds — recruitment / community
15. **Recruit success (Cohort)** — PC rolls Recruitment, succeeds on Cohort →
    PC's log gets "🤝 Recruited `<NPC>` as a Cohort to `<community>`."
16. **Recruit success (Conscript / Convert / Apprentice via High Insight)** —
    same flow with each approach → label adapts to "as a Conscript / Convert /
    an Apprentice".
17. **Recruit reroll-to-success** — fail a recruit, reroll a die that flips
    outcome to success → late-insert path fires; PC's log still gets the
    "Recruited …" entry.
18. **Recruit reroll-to-failure** — succeed, reroll a die that flips outcome
    to failure → membership withdrawn; *no* counter-entry written (the
    original "Recruited" entry stays — minor noise but acceptable; can be
    refined later if it's annoying).
19. **Take Apprentice (post-Wild Success)** — click "Take as Apprentice" →
    master PC's log gets "⭐ Took `<NPC>` as your Apprentice."
20. **Found a community** — Create New Community in CampaignCommunity OR via
    QuickAddModal → founder PC's log gets "🏛️ Founded `<name>` (leader)."
21. **Approve a join request** — leader approves a pending PC join request →
    joining PC's log gets "🏛️ Joined `<name>`."
22. **Manual add PC** — GM uses Add Member panel, picks PC → PC's log gets
    "🏛️ Joined `<name>`."
23. **Manual add NPC** — GM picks NPC instead of PC → no entry (NPCs don't
    have progression_log).
24. **Player self-leave** — PC clicks Leave on their own row → PC's log gets
    "🏛️ Left `<name>`."
25. **GM remove PC** — GM clicks × on a PC row → PC's log gets "🏛️ Left `<name>`."
26. **GM remove NPC** — GM clicks × on an NPC row → no entry (NPCs).
27. **Set new PC leader** — GM picks a different PC as leader → new leader's
    log gets "🏛️ Became leader of `<name>`."
28. **Set new NPC leader** — GM picks NPC → no entry (NPCs).

### Adds — pin drop
29. **Player drops a pin via Quick Add** — open the campaign map, double-click
    an empty cell, fill the pin form, save → PC's log gets "📍 Dropped a
    pin: "`<title>`" (`<category>`)." Currently only works once
    `sql/campaign-pins-rls-members-insert.sql` is applied (existing
    constraint).
30. **GM-only CampaignMap pin** — GM uses the inline "+ Pin" button on
    CampaignMap → no entry (intentionally skipped — GM map authoring isn't
    a character journey moment).
31. **World-mode pin in QuickAddModal** — drop a world map pin → no entry
    (no campaign PC context).

### Display + filter
32. **Filter chip "Community"** — open a PC's full sheet → log filter chips
    include Community / Pin / Met (in addition to existing CDP / Wound /
    Stress / Note). Clicking each chip filters to that type only.
33. **Filter chip color** — Community = lavender (#a87fc4), Pin = gold
    (#ddc070), Met = peach (#e8a87c). Visually distinct from existing
    chips.
34. **Compact mode (in-table CharacterCard)** — only top 10 entries shown
    with "+N more entries" footer. Order is newest-first.
35. **Older characters (legacy entries)** — open a character whose log
    already has `session` or `insight` entries from before this commit →
    those entries still render with their old labels and colors. No NPE,
    no missing-key warnings.

## SQL migrations
None. Schema is jsonb on `characters.data`; no DB changes needed.

## Rollback
Single commit. Revert via `git revert` if anything goes sideways. The
back-compat schema means existing entries survive a revert intact.
