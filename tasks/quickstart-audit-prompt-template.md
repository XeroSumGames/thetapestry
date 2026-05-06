# Quickstart audit — prompt template for Claude chat

This is a copy-paste prompt for **claude.ai** (web/desktop chat). It reproduces the Quickstart-vs-platform audit task using attached files only (no shell access required).

---

## How to use

1. **Open a fresh Claude chat** (claude.ai, web or desktop).
2. **Attach three files**:
   - `tasks/tapestry-rules-canon.md` (the platform's canonical rules export)
   - The Distemper Quickstart Export PDF you want audited
   - The XSE SRD Export PDF (`XSE SRD Export v1.1.17.pdf` or whichever version is current)
3. **Paste the prompt below** as your first message.
4. Claude returns the audit document. You apply the edits in your Affinity Publisher source.

> **Heads up on PDFs**: Claude chat's multimodal PDF reader uses native vision, so the SRD's font-corruption issue (which breaks `pdftotext`/code-style extraction) does NOT bite here. Just attach the PDF directly.

---

## The prompt

```text
You are auditing a Distemper Quickstart PDF against the canonical Xero Sum Engine
(XSE) rules. Three documents are attached:

1. tapestry-rules-canon.md — The PLATFORM'S canonical rules. This is the source of
   truth for every term, table, formula, skill, profession, paradigm, complication,
   motivation, secondary stat, weapon, and combat action. Every entry in this file
   is sourced from the live platform code (lib/xse-schema.ts and app/rules/* pages).
   When this file disagrees with the SRD or the Quickstart, this file wins.

2. XSE SRD Export v1.1.17.pdf — The XSE SRD. Reference for prose and rule
   articulation. Used when the canon.md file doesn't speak to a topic (e.g., narrative
   descriptions of Filling In The Gaps).

3. Distemper Quickstart Export v[VERSION].pdf — The Quickstart you are auditing.
   This is the document you produce edits AGAINST. Don't preserve its content over
   the canonical sources.

PRECEDENCE RULE (LOCKED, DO NOT DEVIATE):

   Tapestry (canon.md) > SRD > Quickstart > Core Rulebook

If a term, skill, paradigm, or table entry is in the Quickstart but NOT in canon.md
or the SRD, it should be DELETED, not preserved or rewritten.
If something is in canon.md but missing from the Quickstart, it should be ADDED
(verbatim from canon.md).
NEVER invent new terms, skills, mechanics, or rules. Every replacement comes from
canon.md or the SRD.

YOUR TASK

Read the Quickstart end-to-end and produce a single audit document (markdown) that
contains, in order:

1. A "deviations from platform/SRD" list — for every place in the Quickstart that
   uses a term not in canon.md, list the page, section heading, the exact FROM text,
   and the exact TO text. Order by page number.

2. A "wholesale rewrite" of every box on the inner-cover Rules Reference (typically
   pages 38–39 of the Quickstart). Use canon.md as your source for every box —
   Dice Checks, Outcomes, Modifiers, Insight Dice, Group Checks, Opposed Checks,
   Skill List, Combat Rounds, Initiative, Combat Actions, Combat Attacks, First
   Impressions, Gut Instincts, Stress & Breaking Point, Negotiations, Item Upkeep,
   etc. Do NOT copy text from the Quickstart's existing inner cover — rebuild each
   box from canon.md.

3. A "grammar and spelling" pass — typos, missing/duplicated words, subject-verb
   agreement, punctuation, internal inconsistency. Each item with FROM and TO.

4. A "style notes" section — non-error consistency questions for the editor's
   judgment (whilst/while, em-dashes vs hyphens, etc.). No FROM/TO required.

OUTPUT FORMAT

Markdown. Page-ordered within each section. Every fix has a clear FROM block and
TO block, both quoted, ready for copy-paste into the Affinity Publisher source.

No flavor commentary. No "great work" filler. No suggestions outside the scope of
"reconcile to the canon" or "fix grammar". The output is a worklist, not an essay.

METHODOLOGY

Before you write a single FROM/TO block:

a. Read canon.md cover-to-cover. This is your source-of-truth for every skill name,
   profession bundle, paradigm, complication, motivation, formula, and table entry.

b. THEN read the Quickstart. As you read, every time you see a skill name or table
   entry, check it against canon.md. If it's not in canon.md, flag it for deletion.

c. NEVER copy a skill name or paradigm name from the Quickstart's existing prose
   without first verifying it's in canon.md. The Quickstart's prose is the LEAST
   canonical source — copying from it propagates errors.

d. When the Quickstart shows a Profession's skill bundle, check it against the
   canon.md "Professions (Table 8)" section — the canonical bundles are 5 skills
   each. If the Quickstart shows 7 skills per profession, the entire bundle needs
   replacing with the canonical 5-skill version.

e. When the Quickstart shows a Paradigm sheet, check the Paradigm name and full
   skill loadout against the "Paradigms" section of canon.md. The platform has
   exactly 12 Paradigms. If the Quickstart shows a Paradigm not in canon.md
   (Beat Cop, Cosmetic Surgeon, Family Doctor, Flea Market Trader, Semi-Pro Athlete,
   Trucker), DELETE that Paradigm sheet entirely.

f. When the Quickstart references a stat called Panic Threshold, that stat does
   NOT exist on the platform. Replace with Stress Modifier (and the surrounding
   prose with Stress / Breaking Point mechanics from canon.md §06).

g. When the Quickstart's body or Pesky's worked example uses a skill not in
   canon.md, replace it with the closest canonical equivalent per canon.md's
   "What's NOT on the platform" section at the bottom.

CANON RECAP (for fast reference while you work)

Skills NOT on the platform (DELETE wherever they appear):
- Intimidation → Manipulation
- Hunting → Survival or Ranged Combat
- First Aid → Medicine*
- Surgery* → Medicine*
- Pharmacology* → Medicine*
- Vehicle Repair* → Mechanic*
- Armorsmith* → Mechanic*
- General Knowledge → Specific Knowledge

Skills missing from older Quickstarts (ADD if missing):
Driving, Gambling, Heavy Weapons*, Mechanic*, Medicine*, Specific Knowledge,
Streetwise.

Paradigms NOT on the platform (DELETE):
Beat Cop, Cosmetic Surgeon, Family Doctor, Flea Market Trader, Semi-Pro Athlete,
Trucker. (Mayor → Small Town Mayor.)

Mechanics NOT on the platform: Panic Threshold (replaced by Stress).

START
```

---

## Notes on the prompt

- The "CANON RECAP" section at the bottom is a fast-reference cheat sheet. It overlaps with content already in `tapestry-rules-canon.md`, but pulling it into the prompt makes the model less likely to drift if the canon file is large.
- The methodology section (a–g) is critical. It's the difference between "Claude reads the Quickstart and reflects its prose back" (bad — propagates errors) and "Claude reads the canon first, then audits the Quickstart against it" (good — what we want).
- The output is markdown — same format as the audit doc we produced in this Claude Code session. Drop the result into `tasks/`, work through it in Affinity Publisher.

## When to regenerate `tapestry-rules-canon.md`

The canon file is a snapshot of `lib/xse-schema.ts` + the `app/rules/*` pages at the time of generation. Regenerate it whenever:

- A skill is added, renamed, or removed from `lib/xse-schema.ts`
- A profession's skill bundle changes
- A paradigm is added, renamed, or removed
- A formula in `deriveSecondaryStats` changes
- A combat action is added or its parameters change
- A Lasting Wound or Breaking Point reaction is renamed/changed

Run: `node scripts/export-canon.mjs > tasks/tapestry-rules-canon.md` (see that file for details).

---

## Variant: shorter prompt for follow-up audits

If you've already done a full audit on v0.1.0X and just want a delta check on v0.1.0Y, use this shorter prompt instead:

```text
Attached: tapestry-rules-canon.md, plus Distemper Quickstart Export v[OLD].pdf
and v[NEW].pdf.

Compare v[NEW] against canon.md. List ONLY the deviations that are still present
in v[NEW]. Skip anything that's been resolved between v[OLD] and v[NEW].

Output: page-ordered FROM/TO list. No grammar pass needed unless I ask. No
inner-cover rewrite — assume that's done.
```
