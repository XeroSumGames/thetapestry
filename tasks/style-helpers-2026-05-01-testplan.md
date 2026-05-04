# Style helpers — 2026-05-01 testplan

Shared design-token helpers + label-style sweep across the 5 hottest files. One PR. Ship to live.

## What's in this PR

### New: [lib/style-helpers.tsx](lib/style-helpers.tsx)

Pulls the recurring inline-style patterns into reusable exports:

- **`LABEL_STYLE`** — 13px Carlito uppercase `.06em` letterSpacing on `#cce0f5`. The most common form-label / section-header inline blob.
- **`LABEL_STYLE_LG`** — same but 14px.
- **`LABEL_STYLE_TIGHT`** / **`LABEL_STYLE_LG_TIGHT`** — same shape with `.08em` letterSpacing. Both spacings live in the codebase (subtly different visually); we keep them separate so the in-place sweep doesn't shift any existing pixel.
- **`SPACING`** — `xs`/`sm`/`md`/`lg`/`xl` token map of the spacing values that recur.
- **`RADIUS`** — `sm`/`md`/`lg`/`xl` borderRadius tokens.
- **`Z_INDEX`** — semantic stacking layers (`dropdown`, `modal`, `modalNested`, `appChrome`, `criticalModal`, `criticalModalOver`) mapped to the magic numbers already in use, so future code stops inventing new ones.
- **`<ModalBackdrop>`** — `position: fixed; inset: 0; flex-center; rgba(0,0,0,X)` shell with `onClose` click handling. Body wrapper stops propagation so clicks inside don't close.
- **`<CloseButton>`** — × button with the muted-grey-then-red hover idiom, plus a `tone="danger"` variant for already-red row removers.

### Sweep

Replaced the literal label-style blob in 5 component files. Behavior is identical — the `LABEL_STYLE` constants resolve to exactly the same CSS as the inline objects they replaced.

| File | Sweeps | Variant used |
|---|---|---|
| [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) | 17 | `LABEL_STYLE_LG` |
| [components/QuickAddModal.tsx](components/QuickAddModal.tsx) | 13 | `LABEL_STYLE` |
| [components/CampaignObjects.tsx](components/CampaignObjects.tsx) | 7 | `LABEL_STYLE_TIGHT` |
| [components/CampaignPins.tsx](components/CampaignPins.tsx) | 6 | `LABEL_STYLE_TIGHT` |
| [components/MapView.tsx](components/MapView.tsx) | 5 | `LABEL_STYLE_LG` + `LABEL_STYLE_TIGHT` |

Modal backdrops, close buttons, spacing, and z-index sweeps deliberately deferred to follow-up PRs — those sweep across many more files and would balloon this diff.

No new deps. No DB migration. No functional behavior change. **Pixel-identical** rendering — every replaced site still resolves to the exact same CSS via spread.

## Test plan

### A. Visual identity check (5 min)
On any page open before/after this PR, the labeled headings should be **pixel-identical**. Walk through:
- [ ] Campaign edit page → Community panel → "Add Member", "Target community", "Faction / flavor label" labels render unchanged.
- [ ] Quick Add Pin modal → "Title", "Lat", "Lng", "Address Search", "Category", "Notes", "Attachments" labels unchanged.
- [ ] Tactical scene → object loot modal → "Or Loot All to" caption unchanged.
- [ ] Campaign pins panel → category labels and section headers unchanged.
- [ ] World map view → pin section labels unchanged.

If any heading subtly changed letterSpacing, the wrong tight/loose variant got applied — fix that one site.

### B. Build + types
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors on any of the swept pages.

### C. Helper smoke (optional)
Future PRs that adopt `<ModalBackdrop>` / `<CloseButton>` should:
- [ ] Verify backdrop click-to-close still fires.
- [ ] Verify clicks inside the modal body don't close.
- [ ] Verify CloseButton's `tone="muted"` and `tone="danger"` render correctly.

This PR doesn't use those components — it just exports them.

## Rollback

`git revert <commit>` then redeploy. The helpers file is removable in isolation (no other code in main depends on it). No DB or schema changes.
