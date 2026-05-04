# CampaignCommunity sweep — 2026-05-01 testplan

ModalBackdrop adoption (4 sites) + Button adoption (5 prominent CTAs) inside `components/CampaignCommunity.tsx`. One PR. Ship to live.

## What changed

### ModalBackdrop sweep (4 modals)

[components/CampaignCommunity.tsx](components/CampaignCommunity.tsx). Each was inline `<div onClick={close}>...</div>` + nested `<div onClick={stopPropagation}>...</div>`:

| Modal | Old zIndex | New zIndex | Tone |
|---|---|---|---|
| Migration (Phase E) | 2100 (literal) | 2100 (literal — non-canonical, preserved) | Magic |
| Schism (Phase E Sprint 4d) | 2100 | 2100 | Magic |
| Publish to Tapestry | 2000 | `Z_INDEX.modal` | Magic |
| Assigned-role mission | 2000 | `Z_INDEX.modal` | Neutral |

The two `2100` migrations + schism modals stay at `2100` for visual stacking parity with other in-page modals at that level. A future PR can normalize the whole 2000/2100/3000 hierarchy together.

### Button sweep (5 buttons)

| Site | Tone | Size | Notes |
|---|---|---|---|
| `Create` (start-community panel) | `primary` | md | Custom `padding: 6px` preserved via style prop |
| `📤 Send Offers` (migration footer) | `magic` | lg | `busy={migrationSubmitting}` |
| `⛓ Confirm Schism` (schism footer) | `magic` | lg | `busy={schismSubmitting}` |
| `🌐 Publish` / `Update Public Info` | `magic` | lg | `busy={publishing}` |
| `Assign` (assignment-role footer) | `confirm` | lg |   |

The matching Cancel buttons in each modal footer use a `transparent + #7ab3d4 border` ghost style — that pattern isn't in the current Button tone palette, so they stay inline. Adding a `ghost` tone to `<Button>` is a clear future PR.

Around 15 other tone-matching buttons in this file (Trade Offer chips, role auto-assign confirms, stockpile add buttons, etc.) are left for a follow-up sweep — keeping this PR's blast radius focused on the modal footers + the headline Create CTA.

## Test plan

### A. Modal smoke (~5 min)
- [ ] Open `/stories/<id>/edit` or wherever the inline `<CampaignCommunity>` mounts. Open each of the four affected modals:
  - **Migration** (when an active community has dissolved survivors): backdrop click closes; click inside stays open. `📤 Send Offers` is disabled until target + members chosen, then magic-purple. `Sending…` reads as busy state on submit.
  - **Schism** (when a community ≥13 members triggers schism): same pattern. `⛓ Confirm Schism` disabled until name + members; busy on submit.
  - **Publish** (Phase E publish flow): backdrop click closes; `🌐 Publish` / `Update Public Info` button has busy state.
  - **Assigned-role mission** (when role flips to `assigned`): backdrop click cancels; `Assign` confirm-green button enabled only when PC chosen.

### B. Button visuals match prior look (~3 min)
- [ ] Visually compare each of the 5 swept buttons against a screenshot or memory. Magic-tone buttons should be the same purple bg + bright purple text. Confirm-tone Assign should be the same green. Primary Create should be the same red bg + white text.
- [ ] Disabled state: each button dims to opacity 0.5, cursor changes (`not-allowed` for disabled, `wait` for busy).

### C. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during normal CampaignCommunity flows.

## Rollback

`git revert <commit>` then redeploy. The helpers (`<ModalBackdrop>`, `<Button>`) stay in place — additive, harmless to leave even if the adoption rolls back.
