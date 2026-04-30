# Rules Extract — Character Development Points (CDP) & Evolution

**Sources** (precedence per `CLAUDE.md`):
1. `XSE SRD v1.1.17 (Small).pdf` — canonical, authoritative.
2. `Distemper CRB v0.9.2.pdf` — Distemper-specific elaboration; defers to SRD on conflicts.

This extract is the source-of-truth for the Character Evolution / CDP
Calculator implementation. Audit against the source PDFs before any
mechanic-level claim — this digest is for design speed, not gospel.

---

## 1. Starting CDP

| Path | CDP RAPID | CDP Skills | Total | Caps |
|---|---|---|---|---|
| Backstory Generation (full 7-step wizard) | 5 | 15 | **20** | Lv 3 attr / Lv 3 skill |
| Paradigm | 3 | 5 | 8 (on top of Paradigm baseline) | same |
| Pregen | 0 | 0 | already statted | same |
| Apprentice (§2a) | 3 | 5 | 8 (on top of Paradigm baseline) | same |

**Backstory Generation step CDP allocation** (SRD §07 + CRB Ch.5):
- Childhood: 1 RAPID + 2 skills (max skill +2)
- Adolescence: 1 RAPID + 3 skills (max skill +2)
- Education: 1 RAPID + 3 skills (max skill +2)
- Profession: 2 RAPID + 4 skills (Profession-bound or freeform)
- Final Touch: 3 skills (max skill +3, max attr +3)
- Pre-game review (no CDP)

(Each backstory step writes its CDP spend to wizard state; total adds
to 20.)

---

## 2. CDP Awards (post-creation)

**End of session** (CRB Ch.6 + SRD §10):
- GM awards **2+ CDP** per character per session.
- Conventional split: 1 CDP for individual contribution (RP, problem-
  solving, storytelling); 1 CDP for group performance (cohesion,
  teamwork, collective beats).
- GM may award **additional CDP** at discretion for outstanding /
  emergent gameplay.

**Already shipped:** the GM Tools → CDP bulk-award modal handles the
award side (selected PCs get CDP with a log entry written to
`roll_log` and progression_log).

---

## 3. CDP Cost Tables

### 3a. Skills — both SRD + CRB agree

| Action | Cost |
|---|---|
| Learn new skill (any baseline → Lv 1 Beginner) | **1 CDP** |
| Raise Lv 1 → Lv 2 (Journeyman) | **3 CDP** |
| Raise Lv 2 → Lv 3 (Professional) | **5 CDP** |
| Raise Lv 3 → Lv 4 (Life's Work) | **7 CDP** |

Formula: `raise N → N+1` costs `(N + (N+1))` CDP = **2N + 1 CDP**.

Vocational skills (P\* / M\* / etc.) are baselined at -3 (Inept) but
"Learn" still costs only 1 CDP — the SRD treats reaching Lv 1 as a
single jump regardless of base. (This matches the existing
`skillStepUp` helper in `lib/xse-engine.ts`.)

### 3b. RAPID Range Attributes — **SRD vs CRB discrepancy**

The two source documents disagree:

| Action | SRD §07 (canonical) | CRB Ch.6 (suspected typo) |
|---|---|---|
| Raise 1 → 2 (Strong) | **6 CDP** (3×2) | 3 CDP |
| Raise 2 → 3 (Exceptional) | **9 CDP** (3×3) | 5 CDP |
| Raise 3 → 4 (Human Peak) | **12 CDP** (3×4) | 7 CDP |

SRD formula: `raise N → N+1` costs **3 × (N+1) CDP** (literal: "3x the
CDP per level being raised").

CRB formula matches the skill formula: `raise N → N+1` costs **(N + (N+1))
CDP**. CRB phrasing strongly mirrors the skill paragraph that precedes
it; this reads as a copy-paste error rather than a deliberate rebalance.

**Per `CLAUDE.md` precedence rule, SRD wins.** Calculator uses SRD costs.
A line in the Evolution UI flags the discrepancy ("RAPID raises follow
SRD §07 — 3× the new level. CRB has a copy-paste typo we ignore.") so
the player knows what's being used.

---

## 4. One-Step-at-a-Time Rule

> "Although a character with enough CDP can evolve multiple skills or
> attributes, each skill or attribute can only be raised one level at
> a time." — CRB Ch.6 p.177

**Calculator enforces:** a single Save can include any number of
distinct attribute / skill raises, but no individual stat may move
more than one level in that Save. Wanting to raise Athletics 1 → 3
requires two separate Saves (and presumably two separate CDP awards
across two sessions, but the rule doesn't strictly require that — the
GM can hand-wave a multi-session arc into one).

---

## 5. Lv 4 Cap Rule

Backstory Generation caps both attributes and skills at Lv 3.
Character Evolution can push to Lv 4 (**Human Peak** for attributes,
**Life's Work** for skills) but only:

> "if the Game Master agrees that it makes sense as part of their
> Character Evolution and the player can Fill In The Gaps as to how
> they have achieved such progression" — CRB Ch.6 p.177

**Calculator behavior:** raising any stat from 3 → 4 requires the
player to write a "Fill In The Gaps" narrative justification (textarea
+ minimum length). The narrative is stored on the progression log
entry so the GM can read it post-spend. No GM-approval gate yet (one-
shot for v1; defer the formal GM approval workflow to a follow-up).

---

## 6. Lv 4 Skill Traits (BACKBURNER per memory rule)

Each skill has a Lv 4 Trait that auto-applies a mechanical bonus when
unlocked (e.g. Inspiration "Beacon of Hope" +4 Morale, Psychology\*
"Insightful Counselor" +3 Morale). Per
`memory:project_lv4_traits.md`:

> Lv4 Skill Traits ship together with the full list or not at all. No
> piecemeal.

**Calculator behavior:** raising a skill to Lv 4 still grants the
flat +1 SMod (mechanical) but does **not** unlock or reference the
skill's Trait. A subtle "Lv 4 Trait pending the full Trait list" line
can render in the post-Lv-4 confirmation so the player knows there's a
future reward, without exposing any partial mechanic.

---

## 7. What Goes On the Character Sheet (the spend ledger)

`characters.data.cdp` (number) — current CDP balance. Already exists.

`characters.data.progression_log` — already curated to journey-marker
entries. The Calculator writes the long-deferred `attribute` / `skill`
/ `item` types per the curation memory. Examples:
- `attribute` — `📈 Acumen +1 (Lv 1 → Lv 2, 6 CDP).`
- `skill` — `📈 Athletics +1 (Lv 2 → Lv 3, 5 CDP).`
- `skill` — `📈 Learned Medicine* (Lv -3 → Lv 1, 1 CDP).`
- `attribute` (Lv 4 Fill-In-The-Gaps) — `📈 Acumen +1 to Human Peak
  (Lv 3 → Lv 4, 12 CDP). "Years on the road have sharpened her
  instincts past anything I trained her in." — Vera Oakes.`

(The narrative line stored on Lv 4 entries gets surfaced inline so
the journal reads as a story.)

---

## 8. Calculator Surface — proposed scope

### v1 — ships in the next sprint

- New modal `<CharacterEvolution>` opens from the existing **Evolution
  button** on `<CharacterCard>` (currently scrolls to Progression Log
  placeholder). Modal covers the SPEND side; the GM's award flow
  already exists.
- Three tabs/sections inside the modal:
  1. **Balance + Activity** — current CDP, last N journal entries.
  2. **Spend** — list of every legal raise with cost preview:
     - Per-attribute row: `RSN +1 (1 → 2, 6 CDP)` or `RSN +1 (1 → 2,
       12 CDP) — Lv 4 Fill In The Gaps` if going to 4.
     - Per-skill row: same shape, includes "Learn <skill>" for any
       baseline skill.
     - Disabled rows when balance < cost.
     - Apprentice support: if the master PC has an Apprentice, a
       toggle "Spend on: my PC / Apprentice <name>" routes the spend
       to either character row.
  3. **History** — filter of progression_log to
     `attribute` / `skill` / `item` types.
- One-step-at-a-time enforcement: clicking a raise opens a confirm
  modal with the Fill In The Gaps textarea (required only for Lv 3 →
  Lv 4); locks the same stat from being clicked again until Save.
- On Save: deduct CDP, update `characters.data.rapid` /
  `data.skills`, write progression_log entry.

### v2 — follow-ups (deferred)

- 1-month Apprentice training widget — closes the §2a follow-up. UI
  lets the master PC pick a skill they have, set a target level (≤ PC
  level − 1), spend CDP, write the Apprentice's training arc. Drives
  the Apprentice's skill jsonb directly.
- Reusing PC's earned CDP on the Apprentice — same widget, with a
  "spend from PC's pool" toggle.
- GM approval gate for Lv 4 raises — a real "GM must approve" status
  on the entry instead of just the narrative input.
- Per-session CDP cap enforcement — currently trust + log;
  measurable from the progression_log timestamps if needed.

---

## 9. Out of scope (explicit non-goals)

- Changing the GM Award flow (already shipped).
- Refunding CDP (a spend is permanent; GMs can hand-edit if a player
  regrets it, but the Calculator has no Undo).
- Per-Trait selection UI at Lv 4 (Lv 4 Trait backburner).
- Cross-character CDP transfer (no narrative basis in the rules).
- Renaming a skill / attribute (out of scope for evolution; that's
  schema-level).
