# CDP Calculator — audit-log close-out testplan

The CDP Calculator was already 95% shipped via [`<CharacterEvolution>`](components/CharacterEvolution.tsx) (the modal opened from the purple Evolution button on every CharacterCard). Audit found one spec gap: the original todo line said "append a `roll_log` entry with `outcome='evolution'` so the table feed surfaces it." That insert was missing.

This sprint adds:
1. The missing `roll_log` insert in `commit()` after the existing progression-log append.
2. A compact-renderer branch in [lib/roll-helpers.ts](lib/roll-helpers.ts) for `outcome='evolution'` so the entry reads cleanly in the Logs tab + Both tab.

**No SQL migration required** — `roll_log` already exists; this just adds another `outcome` value via the existing insert path.

---

## 0. Sanity — what's already shipped

The CDP Calculator UX has been live for some time:
- Purple **Evolution** button on every CharacterCard ([CharacterCard.tsx:396](components/CharacterCard.tsx)).
- Opens `<CharacterEvolution>` modal ([CharacterCard.tsx:1140-1156](components/CharacterCard.tsx)).
- Modal lists buyable upgrades — RAPID raises (cost 3 × (N+1)), skill raises (cost 2N+1), new-skill learns (cost 1 CDP). Lv 4 raises require a 12+ char "Fill-In-The-Gaps" narrative.
- On commit: deducts CDP from `character_states.cdp`, writes the new value to `characters.data` (RAPID) or campaign_npcs (apprentice raises), appends a progression-log entry of type `'attribute'` or `'skill'`.
- Cost helpers live in [lib/cdp-costs.ts](lib/cdp-costs.ts).

Pre-existing tests of the spend flow pass — this testplan is just the audit-log addition.

---

## 1. Self-spend — RAPID raise

1. Sign in as a player. Find a campaign where your PC has at least 3 CDP available (e.g. raise INF from 0 → 1 = 3 CDP).
2. Open the character card → click **Evolution** (purple button between Inventory and Apprentice).
3. Pick an attribute, click the +1 button, confirm. (No Lv 4 narrative needed.)
4. Modal closes; CDP balance decremented; attribute raised.
5. **NEW:** open the table page's Logs tab → a fresh entry appears: `<character> — <Attribute> Lv 0 → Lv 1 — 3 CDP.`
6. **DB sanity:** `SELECT outcome, label, damage_json FROM roll_log ORDER BY created_at DESC LIMIT 1;`
   - `outcome = 'evolution'`
   - `label = '<character name> — <Attribute Full Name> Lv 0 → Lv 1 — 3 CDP.'`
   - `damage_json = { kind: 'rapid', key: 'INF', from_level: 0, to_level: 1, cost: 3, target: 'self', apprentice_npc_id: null, narrative: null, new_cdp_balance: <prev - 3> }`

## 2. Self-spend — skill raise

1. Same campaign, this time raise a skill from 1 → 2 (cost = 3 CDP).
2. After commit, Logs tab shows: `<character> — <Skill Name> Lv 1 → Lv 2 — 3 CDP.`
3. damage_json: `kind='skill'`, `key='<Skill Name>'`, `from_level=1`, `to_level=2`, `cost=3`.

## 3. Self-spend — new skill (level 0 → 1)

1. Raise an untrained skill (current = 0 or -3). The CharacterEvolution modal renders this as "Learned <skill> (Lv 1)".
2. Logs tab shows: `<character> — Learned <Skill> (Lv 1) — 1 CDP.`
3. `kind='skill'`, `from_level=0` (or -3), `to_level=1`.

## 4. Lv 4 raise — narrative quoted in the feed

1. Raise an attribute from 3 → 4 (cost = 12 CDP). Modal demands a "Fill-In-The-Gaps" narrative; type at least 12 characters.
2. Submit.
3. Logs tab entry includes the quoted narrative inline: `<character> — Influence Lv 3 → Lv 4 — 12 CDP. "<your narrative>"`
4. damage_json: `narrative='<your typed text>'`, `from_level=3`, `to_level=4`.

## 5. Apprentice raise

**Setup:** master PC has an Apprentice (NPC). Open Evolution modal — there's a target toggle "Self / Apprentice".

1. Pick Apprentice. Pick a skill or RAPID raise. Commit.
2. Logs tab shows: `<master>'s Apprentice (<Apprentice Name>) — <Skill> Lv 1 → Lv 2 — 3 CDP.`
3. damage_json: `target='apprentice'`, `apprentice_npc_id='<campaign_npcs.id>'`.
4. CDP deducted from MASTER PC's `character_states.cdp` (per Distemper CRB §08 p.21 — master's CDP fuels both their own and the Apprentice's growth).

## 6. Compact renderer

The Both tab (chat + rolls interleaved) uses a tighter renderer. Confirm an evolution row reads as a one-liner without the verbose dice card (since there are no dice in this roll type). The compact line drops the leading `📈` emoji and shows the headline + cost.

Compare format: Stress Check on the Both tab shows mechanical dice, evolution row shows a clean prose line. ✅ if so.

## 7. Failure mode — auth lapsed mid-spend

If `getCachedAuth()` returns no user, the roll_log insert is skipped silently (warning logged to console). The progression-log entry + character data updates still commit. This is intentional — the spend is the source of truth; the feed entry is convenience. No data loss.

## 8. Regression sanity

Run the existing CharacterEvolution flow end-to-end after this commit:
- Evolution button still opens the modal.
- Cost preview before commit unchanged.
- Lv 4 narrative gate unchanged.
- Apprentice toggle unchanged.
- progression_log entries still append (independent path from the new roll_log path).

---

## Open follow-ups (NOT in this sprint)

- **Lv 4 Skill Trait surface.** Per memory `project_lv4_traits.md`, Lv 4 Traits ship together or not at all. The Evolution modal raises to Lv 4 but doesn't yet expose the Trait selector — that's gated on the full Trait list landing.
- **CDP earning history surface.** Today the calculator shows current balance only. A "spend history" panel could read from `roll_log WHERE outcome='evolution' AND character_name='<name>'` to show prior raises. Out of scope for this audit.
- **Trait costs.** No Trait cost helper in [lib/cdp-costs.ts](lib/cdp-costs.ts) — depends on the same locked Lv 4 Trait list. Cost shape (probably 5/10/15 per tier) lands when the list does.

---

## Rollback

`git revert <commit>`. The roll_log insert is a fire-and-forget addition; reverting drops the audit-log row but the spend flow is unaffected.
