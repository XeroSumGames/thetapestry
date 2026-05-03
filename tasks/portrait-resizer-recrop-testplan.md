# Portrait Resizer — Re-crop after Batch — Test Plan

Closes the third sub-item of the "Tools enhancements" row in [letsgototheend.md](letsgototheend.md): "Manual crop control on the resizer". Auth gating + batch already shipped (`b0f59ee`); this adds the missing fix-misses-after-batch path.

## Where
- File: [app/tools/portrait-resizer/page.tsx](../app/tools/portrait-resizer/page.tsx)
- Route: `/tools/portrait-resizer` (Thriver-only)

## What changed

1. **`BatchEntry` type** — tracks each successful batch upload's source File + storage paths + a thumbnail ObjectURL.
2. **`handleBatch`** — pushes a `BatchEntry` after each successful upload (in addition to the existing `batchResults.ok++`).
3. **Re-crop thumbnail grid** — renders inside the batch panel after upload completes. Each entry shows the auto-cropped 256 thumbnail, the assigned `NPC-MAN-NNN` / `NPC-WOMAN-NNN` label, and a `✎ Re-crop` button.
4. **`startRecrop(entry)`** — loads the entry's source File into the existing single-image editor, sets `recropTarget`, scrolls to the editor.
5. **Re-crop banner** — replaces the gender toggle + Download button block when `recropTarget` is set. Header reads `✎ Re-crop mode — overwriting NPC-MAN-005`. Action button is `💾 Save Crop (overwrite)`.
6. **`handleSaveRecrop`** — renders 256/56/32 from the edited circle, uploads to the entry's existing storage paths with `upsert: true`. **No counter increment, no metadata insert** (the `portrait_bank` row already exists with the same URLs). Refreshes the entry's thumbnail.
7. **ObjectURL cleanup** — entry's old preview URL is revoked when re-cropped; all entries' URLs revoked on component unmount.

## Test plan

### Happy path — single batch + spot-fix
- [ ] Open `/tools/portrait-resizer` as a Thriver. Confirm the page renders.
- [ ] Pick the gender pill (Male). Pick 3 portrait images via the batch input. **Expected:** progress shows N/3, then results show `✓ 3 uploaded · ✗ 0 failed`. A new "Uploaded — click Re-crop to fix any that auto-center missed" section appears with 3 thumbnail cards, each labeled `NPC-MAN-NNN`.
- [ ] Click `✎ Re-crop` on the second thumbnail. **Expected:** the page scrolls to the editor; the source image loads with a centered max-radius circle; a red banner appears at the bottom reading `✎ Re-crop mode — overwriting NPC-MAN-NNN`; the original Gender + Download block is hidden.
- [ ] Drag the circle off-center, shrink the radius. Confirm the 256/56/32 previews update live.
- [ ] Click `💾 Save Crop (overwrite)`. **Expected:** button shows `⏳ Saving…`, then `✓ Re-cropped` for ~2.5s. The editor closes (resets). The thumbnail in the grid for that entry now shows the re-cropped circle.
- [ ] Hard-refresh the page. Open one of the public URLs from `portrait_bank` (Storage UI or DB query). Confirm the file was overwritten — no stale auto-center version.

### Cancel re-crop
- [ ] Re-crop a thumbnail. Click `Cancel` instead of Save. **Expected:** editor closes; thumbnail unchanged; no upload fired.

### Multi-batch / mixed-gender
- [ ] Upload 2 male portraits via batch. Switch to Female. Upload 2 female portraits via batch. **Expected:** the grid shows all 4, each with its correct `NPC-MAN-NNN` / `NPC-WOMAN-NNN` label.
- [ ] Re-crop one of the male entries. Confirm the re-crop banner says `MAN-NNN` (not the currently-selected gender) and the save writes to the male storage paths.

### Re-crop the same entry twice
- [ ] Re-crop entry A. Save. Re-crop entry A again. Save with a different circle position. **Expected:** thumbnail updates each time; no ObjectURL leak warnings in DevTools console; the file at the storage path matches the latest crop.

### Switch to single-image flow mid-session
- [ ] After a batch run, drag a NEW image onto the drop zone. **Expected:** the drop zone hides, the editor loads the new image with a max-radius circle, the single-image action panel shows (Gender pill + `⬇ Download NPC-MAN-NNN`). The thumbnail grid above stays intact.
- [ ] Click `Process Another` to clear. The grid still persists.

### Error path
- [ ] Drop one image into batch. Disable network. Re-crop and Save. **Expected:** banner shows `Re-upload failed: …` (no crash); thumbnail unchanged; user can retry once network is back.

### Memory / cleanup
- [ ] Open DevTools → Performance → Memory. Run a batch of 10 images. Re-crop 5 of them. Navigate away. **Expected:** no detached HTMLImageElements / BlobURLs persist beyond unmount.

## Regression suite (existing flows must still work)

- [ ] Single-image flow (no batch first): drop one image → adjust circle → click `⬇ Download NPC-MAN-NNN`. Confirms counter increment + metadata insert + local download still work.
- [ ] Batch flow without re-crop: pick 3 images → confirm all 3 upload, results show `✓ 3 uploaded`, thumbnails appear, no re-crop touched. Verify `portrait_bank` has 3 new rows and counter advanced by 3.
- [ ] Auth gating: log in as a non-Thriver. Confirm "Thriver access only" still renders.

## What this does NOT cover (out of scope)
- Manual crop on the **single-image** flow — already works (drag + slider).
- Bulk re-crop multiple entries at once — out of scope; one at a time keeps the UX simple.
- Per-entry delete from the grid (e.g. "this one was a mistake, remove it from `portrait_bank`") — separate item if you want it.
