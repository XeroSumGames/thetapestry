# Z-index NoteAttachmentsView lightbox — 2026-05-03 testplan

Single-line z-index normalization. Audit identified the NoteAttachmentsView lightbox using a literal `10010` instead of the canonical `Z_INDEX.criticalModalOver` (10100). Cleanest single-site normalize available; the other off-scale literals in the codebase (`10001` × 2) have intentional `+1` offsets and were deliberately skipped.

## What changed

[components/NoteAttachmentsView.tsx:88](components/NoteAttachmentsView.tsx:88). `zIndex: 10010` → `zIndex: Z_INDEX.criticalModalOver`. Import added at top of file.

Same semantic — this lightbox sits above whatever critical modal is hosting the notes view. The hard-coded value was defensive; the canonical constant is just clearer about why.

## Test plan

### A. Lightbox still overlays correctly (2 min)
- [ ] Open a note that has an image attachment (campaign note, NPC sheet attachment, etc.).
- [ ] Click the image → lightbox opens. Confirm it overlays anything that was visible (modal headers, sidebars, etc.).
- [ ] Click the dim backdrop → lightbox closes.
- [ ] `cursor: zoom-out` still shows when hovering the backdrop.

### B. Build
- [ ] `npx tsc --noEmit` passes (verified pre-commit).

## Rollback

`git revert ab22260 --no-edit && git push origin main`. Restores the literal `10010`. Same visual stacking either way.

## Followup

Other off-scale z-index literals remaining in the codebase:
- `app/stories/[id]/table/page.tsx:5828` — `zIndex: 10001` on a relative-positioned header. Not a modal layer; left alone.
- `app/stories/[id]/table/page.tsx:10950` — `zIndex: 10001` on the Insight Save modal. Intentional `+1` above `criticalModal` (10000) — preserved to avoid breaking stacking with concurrent critical modals.
