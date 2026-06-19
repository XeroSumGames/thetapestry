# Story Page - Hero Cover Image Test Plan

## URL
`thetapestry.distemperverse.com/stories/<any-campaign-id>`

## Steps

### Part A - Module cover inheritance
1. Open a story page for a campaign that was created from a /rumors module (one that had a cover image on the module card)
2. Confirm the 240px left column in the hero shows the module's cover image filling the space
3. Open a story page for a campaign NOT based on any module
4. Confirm the left column shows "NO COVER" text (readable, not near-invisible)
5. Report what you see

---

### Part B - GM upload
6. Open any story page as the **GM** (not a player)
7. If there's no cover: confirm "NO COVER" text is visible (roughly #666 gray, not black)
8. Confirm below the text there's a "click to upload" underlined link
9. Click the "click to upload" link - confirm a file picker opens
10. Pick any JPG or PNG photo
11. Confirm "Uploading..." text appears briefly while the upload runs
12. Confirm the image appears in the hero cover column after upload completes
13. Refresh the page - confirm the uploaded cover image is still there (persisted to DB)
14. Report what you see

---

### Part C - Player view
15. Open the same story page as a **player** (not GM)
16. If the campaign has no cover: confirm plain "NO COVER" text appears (no "click to upload" link - that's GM only)
17. Report what you see
