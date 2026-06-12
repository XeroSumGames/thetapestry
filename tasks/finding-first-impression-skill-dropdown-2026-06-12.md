# Finding - First Impression skill picker should be a dropdown, not a chip bar

**Lane:** routed to **Hunt & Peck**.
**Reporter:** Xero 2026-06-12 screenshot. "first impression - we need
to change the SKILL selection to match other modals. it should be a
drop down with all skills."

## The inconsistency

[FirstImpressionModal.tsx:298-318](app/stories/[id]/table/components/FirstImpressionModal.tsx:298)
renders the skill picker as a **chip bar** - 4 horizontal buttons:

```tsx
{(['best', 'Manipulation', 'Streetwise', 'Psychology'] as const).map(opt => (
  <button ... >
    {opt === 'best' ? `Best (${pc?.bestSkillName ?? 'Auto'})` : opt}
  </button>
))}
```

Every other modal that picks a skill uses a `<select>` dropdown with
`<optgroup>` separators. Reference pattern from
[CommunityProxyRecruitModal.tsx:346-359](components/CommunityProxyRecruitModal.tsx:346):

```tsx
<select value={skill} onChange={e => setSkill(e.target.value)} ... >
  <option value="">- pick a skill -</option>
  <optgroup label={`Suggested for ${approach}`}>
    {suggestedSkills().map(s => (
      <option key={`sug-${s}`} value={s}>
        {s} ({getNpcSkillLevel(leader, s) >= 0 ? '+' : ''}{getNpcSkillLevel(leader, s)})
      </option>
    ))}
  </optgroup>
  <optgroup label="All social skills">
    {RECRUITMENT_ALL_SKILLS.filter(s => !suggestedSkills().includes(s)).map(s => (
      <option key={`all-${s}`} value={s}>
        {s} ({getNpcSkillLevel(leader, s) >= 0 ? '+' : ''}{getNpcSkillLevel(leader, s)})
      </option>
    ))}
  </optgroup>
</select>
```

## Fix shape

Replace the chip-bar block in FirstImpressionModal (`:298-318`) with a
`<select>` matching Recruit's pattern. Options:

- `- pick a skill -` (placeholder, value `""`)
- `<optgroup label="Auto">`:
  - `Best (Manipulation)` (or whichever the bestSkillName resolves to)
    with value `'best'`
- `<optgroup label="Social skills">`:
  - `Manipulation (+N)` with value `'Manipulation'`
  - `Streetwise (+N)` with value `'Streetwise'`
  - `Psychology (+N)` with value `'Psychology'`

The level chip after each name comes from the rolling PC's skill
levels - already plumbed through `eligiblePcs[].manipLevel`,
`.streetLevel`, `.psychLevel`. Pull from there; no new state.

Reuse the existing `inputStyle` (declared at the top of the file, used
by the PC and NPC `<select>` blocks at lines 324 and 341). That gives
visual consistency to the rest of the modal automatically.

## Canon scope question

Xero said "all skills" in the message. Canon (FirstImpressionModal
blurb line 290 + SRD): First Impression uses **Influence + the social
skill you pick**. The 3 social skills are Manipulation / Streetwise /
Psychology.

Interpretation: "all skills" in Xero's message most likely means "all
the skill OPTIONS" the dropdown should expose - i.e. the 3 social
skills plus the Best auto-pick. NOT a canon expansion to non-social
skills.

If HP reads it differently (Xero wants ANY skill on FI, expanding
canon), flag back to Puffer/Xero before shipping. Safer to ship the
UI-consistency interpretation first.

## Acceptance

- The skill picker is a `<select>` dropdown, not a chip bar.
- It matches the visual style of the PC and NPC `<select>` blocks at
  lines 324 and 341 of the same modal.
- It matches the optgroup pattern used by Recruit
  (`CommunityProxyRecruitModal.tsx:346-359`).
- Each option shows the PC's level in that skill in parens
  (e.g. `Manipulation (+1)`, `Streetwise (-1)`).
- `Best` stays as an auto-pick option that resolves to the PC's
  highest social skill level (no behavior change vs. today).
- Default selection stays as `best` (the current default).
- Roll still fires correctly via `handleRoll` (data flow unchanged).
- Build + tests + font/role/em-dash/arch all green.

## Tracking

Append to todo.md PLAYTEST POLISH ROUTES:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-06-12] First Impression skill picker should be a dropdown, not a chip bar** - `app/stories/[id]/table/components/FirstImpressionModal.tsx:298-318` uses a chip bar; other modals (Recruit etc.) use `<select>` with `<optgroup>` separators. Replace with dropdown matching `CommunityProxyRecruitModal.tsx:346-359` pattern. Options: Best (Manipulation) auto, plus the 3 social skills with level chips per option. Finding: `tasks/finding-first-impression-skill-dropdown-2026-06-12.md`. Trigger: Xero screenshot 2026-06-12.
```
