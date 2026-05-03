# `ghost` Button variant + cancel-button sweep — 2026-05-03 testplan

New `variant: 'solid' | 'ghost'` prop on `<Button>` + sweep of 6 modal cancel/back buttons. One PR. Ship to live.

## What's added

### `<Button variant="ghost">`

[lib/style-helpers.tsx](lib/style-helpers.tsx). Adds:

- A new `variant?: 'solid' | 'ghost'` prop (default `'solid'`).
- A `chroma` field on each tone in `BUTTON_TONES` — the tone's signature color, used by ghost for both border and text.

For `info` (the most common ghost), chroma = `#7ab3d4` (matches the existing pattern). For `primary` / `danger`, chroma = `#c0392b` (red on transparent). For `confirm` / `magic` / `warning`, chroma = the bright accent color of each tone.

Solid behavior is unchanged — the existing 5 sites (Continue / Save / Send Offers / Confirm Schism / Publish / Assign) render bit-for-bit identical to before.

### Sweep — 6 cancel/back buttons

| File | Button | Tone | Variant |
|---|---|---|---|
| [components/ApprenticeCreationWizard.tsx](components/ApprenticeCreationWizard.tsx) | Back / Cancel (step-aware) | `info` | `ghost` |
| [components/CharacterEvolution.tsx](components/CharacterEvolution.tsx) | pending Cancel | `info` | `ghost` |
| [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) | Migration Cancel | `info` | `ghost` |
| [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) | Schism Cancel | `info` | `ghost` |
| [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) | Publish Cancel | `info` | `ghost` |
| [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) | Assignment Cancel | `info` | `ghost` |

All 6 are `padding: '6px 12px'` or `'6px 14px'` — slightly tighter than the helper's `size="md"` default (`'8px 12px'`). I preserved exact padding via `style={{ padding: '6px 14px' }}` (Wizard) or `{ padding: '6px 12px' }` (others) overrides so this is a pixel-identical render.

CharacterEvolution gained a `Button` import alongside its existing `ModalBackdrop` + `Z_INDEX`.

Other tone variants of the ghost pattern (e.g. `tone="primary" variant="ghost"` for red-outline destructive cancels at [CampaignCommunity:2341](components/CampaignCommunity.tsx:2341), [:2382](components/CampaignCommunity.tsx:2382), [:2750](components/CampaignCommunity.tsx:2750), [CampaignSnapshots:230](components/CampaignSnapshots.tsx:230)) also work via the new variant, but I deferred those to a separate sweep — keeping this PR focused on the proven info-blue cancel pattern.

No DB migration. No functional behavior change.

## Test plan

### A. Each swept button still works (~5 min)
- [ ] Trigger an Apprentice recruit. Walk through Identity → Profession → RAPID → Skills → Confirm. The left-side button reads "Cancel" on Identity, "← Back" on later steps; backdrop click and disabled state during save both behave as before.
- [ ] Open Character Evolution on a PC with CDP. Click any spend row. The pending modal appears with "Cancel" + "Confirm" buttons. Cancel dismisses; disabled while saving.
- [ ] In the inline `<CampaignCommunity>` panel, trigger each of the 4 modals (Migration, Schism, Publish, Assignment) and verify each Cancel button:
  - Renders with the same transparent + info-blue outline as before.
  - Disables (where applicable) during the corresponding submit.
  - Closes the modal on click.

### B. Visual equivalence (~3 min)
Side-by-side compare against the prior look. Each ghost cancel should be:
- Transparent background.
- 1px `#7ab3d4` border.
- `#7ab3d4` text.
- Carlito uppercase 13px with `.06em` letterSpacing.
- Cursor changes to `not-allowed` and opacity drops to 0.5 when disabled (was 0.4 in pre-fix sites; this is a 0.5 vs 0.4 micro-shift baked into the shared helper. Worth flagging in the test, but matches every other adopted Button site).

### C. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during normal modal-open-cancel flows.

## Followup

The `ghost` variant unblocks a larger sweep:
- **Primary-red ghost cancels** at [CampaignCommunity.tsx:2341, :2382, :2750](components/CampaignCommunity.tsx:2341), [CampaignSnapshots.tsx:230](components/CampaignSnapshots.tsx:230) — these match `tone="primary" variant="ghost"` exactly.
- **Confirm-green ghost** at [CampaignCommunity.tsx:2480](components/CampaignCommunity.tsx:2480) — matches `tone="confirm" variant="ghost"`.
- **Magic-purple ghost** at [CampaignCommunity.tsx:2743](components/CampaignCommunity.tsx:2743) — matches `tone="magic" variant="ghost"`.

Deferred so this PR's blast radius stays focused.

## Rollback

`git revert <commit>` then redeploy. The `ghost` variant + `chroma` field stay in place — additive, harmless.
