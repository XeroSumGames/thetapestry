# ModalBackdrop adoption — 2026-05-01 testplan

The shared `<ModalBackdrop>` shipped with `lib/style-helpers.tsx` but had zero callers. This PR adopts it across 5 single-purpose modal files. One PR. Ship to live.

## What changed

Each of these files dropped its inline `<div onClick={onClose} style={{ position: 'fixed', inset: 0, ...}}>` backdrop + `<div onClick={e => e.stopPropagation()}>` panel-wrapper pattern in favor of `<ModalBackdrop onClose={...} zIndex={Z_INDEX.X} opacity={Y} padding="…">`:

- [components/ModulePublishModal.tsx](components/ModulePublishModal.tsx) — `Z_INDEX.modal` (2000), opacity 0.75, padding 20px
- [components/ModuleReviewModal.tsx](components/ModuleReviewModal.tsx) — same
- [components/CommunityMoraleModal.tsx](components/CommunityMoraleModal.tsx) — two backdrops (form stage + result stage), both `Z_INDEX.modal` (2000), opacity 0.75
- [components/QuickAddModal.tsx](components/QuickAddModal.tsx) — `Z_INDEX.criticalModal` (10000), opacity 0.88, padding 1rem
- [components/TradeNegotiationModal.tsx](components/TradeNegotiationModal.tsx) — `Z_INDEX.criticalModalOver` (10100, sits above the table modal layer), opacity 0.85

Local `backdrop` style consts that became dead weight after the swap were removed; their explanatory comments now point at the helper.

The other ~16 modal sites in the codebase (CharacterCard, NpcRoster, CampaignCommunity, etc.) deferred — those files have multiple interlocking modals and the regression risk on a one-shot sweep is higher. Helper is sitting there ready when those get touched.

`<CloseButton>` adoption deferred — its defaults (13px font, muted/danger tones) don't match the modal-header × buttons in this codebase (22px, themed-color × in a header bar). Needs a `size` prop and likely a `tone="themed"` variant before it's worth sweeping. Tracked.

## Subtle behavior change

Pre-fix, ModulePublishModal's Cover-Image Cropper sat as a sibling of the panel inside the publish modal's backdrop div. Clicks on the cropper's own backdrop (outside the cropper's panel) ALSO bubbled up to the publish modal's `onClose`, closing both at once. That latent bug went away as a side effect of the helper's `display: contents` wrapper — clicks on the cropper now correctly close only the cropper.

No functional change in any of the other four files.

## Test plan

### A. Each modal opens, closes, and stays open on click-inside (~8 min)
- [ ] **ModulePublishModal** — open from a campaign that's about to publish. Click anywhere inside the panel — modal stays open. Click the dim backdrop area outside the panel — modal closes. Cancel + ✕ button still work.
- [ ] **ModuleReviewModal** — open from a subscriber's update flow. Same checks. Apply Selected button still works.
- [ ] **CommunityMoraleModal — form stage** — open Weekly Check from a community panel. Backdrop click closes; clicks on inputs / sliders / leader picker stay open. Run Weekly Check still advances to result stage.
- [ ] **CommunityMoraleModal — result stage** — same, and Finalize button still saves.
- [ ] **QuickAddModal** — open via the table's Quick Add button OR via map double-click. Backdrop closes; click on form fields stays open. Save Pin / Save Community still work.
- [ ] **TradeNegotiationModal** — start a barter against an NPC AND against a community stockpile. Backdrop closes (UNLESS `applying` is true — that path is preserved by passing `onClose={!applying ? onClose : undefined}`). Apply Deal still completes the trade.

### B. ModulePublishModal cropper bug check (~3 min)
- [ ] Open the publish modal. Click "Upload cover image". Pick a file → cropper opens.
- [ ] Click the cropper's dim backdrop area outside the cropper panel. **Pre-fix this would have closed BOTH the cropper AND the publish modal.** Post-fix, only the cropper closes.
- [ ] Pick another file → cropper re-opens. Click ✕ → cropper closes; publish modal stays open.

### C. Build + types
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during open / interact / close cycles for any of the 5 modals.

## Rollback

`git revert <commit>` then redeploy. The helper file remains in place — additive, harmless to leave even if the adoption rolls back.
