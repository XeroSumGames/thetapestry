# Token Library Phase 1 - Test Plan

**Commit:** 76ff7ff  
**Date:** 2026-06-12

## What was shipped

Two live DB columns: `characters.portrait_url text NULL` + `portrait_bank.is_private boolean DEFAULT false`.

PC portrait -> map token flow wired end-to-end.

---

## Test 1 - Character sheet portrait upload

1. Open `thetapestry.distemperverse.com/character-sheet?char=<any char you own>`
2. Below the character card, above Session Notes, you should see a **Portrait / Map Token** section
3. If the character has no photo: a dashed circle placeholder + "Upload photo" button
4. Click "Upload photo" - pick any JPG/PNG
5. **EXPECT:** circular preview appears within ~3s; "Replace photo" replaces the button

**Verify in DB:**
```sql
SELECT id, name, portrait_url FROM characters WHERE portrait_url IS NOT NULL LIMIT 5;
```
Should show the row with a `character-portraits` storage URL.

---

## Test 2 - PC portrait appears as map token

1. On a campaign table (`/stories/<id>/table`), ensure a PC has a portrait (Test 1 done)
2. GM opens the tactical map + places that PC token (via the "Place on Map" button in their card)
3. **EXPECT:** the token on the map shows the PC's portrait instead of a blank/default avatar

---

## Test 3 - Character edit save syncs portrait_url

1. Open `thetapestry.distemperverse.com/characters/<id>/edit`
2. On Step 0 (Character Concept), upload or pick a photo from the bank
3. Save and navigate away
4. **VERIFY in DB:** `characters.portrait_url` is set on that row

---

## Test 4 - Portrait Bank Picker shows only public portraits

1. Go to any character edit, Step 0, click "Pick from library"
2. **EXPECT:** the picker loads without error; all rows displayed (is_private=false filter is additive since all existing rows default to false - should look identical to before)

---

## Test 5 - Populate NPC portraits (already shipped, regression check)

1. On a campaign table, open GM Tools -> Populate, generate 10 NPCs
2. **EXPECT:** generated NPCs show tier-colored silhouette avatars in the roster

---

## Test 6 - Remove portrait

1. On character-sheet with a portrait set, click "Remove"
2. **EXPECT:** portrait disappears from the section, CharacterCard thumbnail (if any) also clears

---

## Out of scope for this plan

- Phase 2 (folder bulk-upload at /tools/token-creator) - coming next
- Phase 3 (mass place from library onto map) - post-foundations
