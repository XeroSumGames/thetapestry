# Token Library Phase 2 - Mass Upload Spec

**Author:** Hunt & Peck (Claude), 2026-06-12
**Status:** DRAFT - awaiting Xero validation before build
**Prerequisite:** Phase 1 shipped (commit 76ff7ff) - `portrait_bank.is_private` column live

---

## What this is (and is not)

**Phase 2: portraits-only bulk upload.** GM drops a folder of NPC portrait images; all upload in one pass and become immediately available in the NPC portrait picker.

**Not Phase 2:**
- Map placement (Phase 3, explicitly deferred in the test plan)
- NPC auto-creation from filenames (portraits land in the bank; GM assigns them to NPCs through existing NPC roster portrait picker)

---

## User story

GM has 20-30 custom NPC portrait images on disk. They want them in Tapestry before the next session so they can assign them to NPCs. Currently this requires 20 separate token-creator uploads (one at a time, manual crop each). Phase 2 eliminates that.

---

## Design recommendation

### Where it lives
**New tab in `/tools/token-creator`** - "Bulk Upload" tab next to the existing "Crop & Upload" tab. Keeps portrait tooling centralized without a new route.

No longer Thriver-only for bulk: any authenticated user can bulk-upload **private** portraits. Thriviers can still flip is_private to false (global bank). Non-Thriviers get is_private=true locked.

### Flow
1. **Drop zone** - `<input multiple accept="image/*">` + drag-drop overlay. Max 10 MB/file (existing safe-upload limit). No folder API (avoids browser compatibility issues; user selects files manually).
2. **Pre-upload grid** - each selected file shows auto-center thumbnail preview + editable name field (pre-filled from filename: strip extension, replace `_/-` with spaces, title-case).
3. **Upload All** button - queues sequentially, shows per-file status (Pending / Uploading / Done / Error).
4. **Post-upload grid** - same grid with Done/Error per row. Error rows show reason + retry.

### Auto-crop behavior
Center-crop to square, then 256px circle mask. No manual adjustment per image. Users who need precise crops use the existing single-image editor (the "re-crop" button on any result row opens the single editor for that image, same as today's `BatchEntry` recrop flow).

### Naming convention (BREAKING vs current)
Current: `portrait_bank` has `number` (int, NOT NULL) and `gender` (text check: 'man'|'woman', NOT NULL). The counter + gender pair was designed for the global public bank (sequential numbered portraits by gender). This doesn't fit custom/private portraits with arbitrary names.

**Recommended schema change for Phase 2:**

Option A (preferred): add `name text NULL` and make `number` and `gender` nullable. Private portraits use name-based paths; public bank portraits keep the existing number+gender scheme. Path: `{userId}/{slug}.jpg` for private, `{gender}/{number}.jpg` for public.

Option B (simpler, no schema change): force a gender selection per bulk upload (a "Mostly men / Mostly women / Mixed" radio that assigns gender to all uploaded portraits in this batch). Keeps the schema intact. Tradeoff: assigns a gender to portraits that might not need one.

**I recommend Option A.** The gender+number constraint is an artifact of the public bank numbering system. Private GM portraits don't need it, and adding a null-check is clean. Schema diff:

```sql
ALTER TABLE portrait_bank
  ALTER COLUMN number DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN gender DROP CONSTRAINT portrait_bank_gender_check,
  ADD COLUMN name text;
-- New check: either (number + gender) or name must be set
ALTER TABLE portrait_bank ADD CONSTRAINT portrait_bank_id_or_name
  CHECK (name IS NOT NULL OR (number IS NOT NULL AND gender IS NOT NULL));
```

### PortraitBankPicker update (required for Phase 2 to surface privately-uploaded portraits)
Current query: `.eq('is_private', false)` - only shows public bank.
Phase 2 must show the GM's own private portraits too:

```ts
.or(`is_private.eq.false,and(is_private.eq.true,created_by.eq.${userId})`)
```

Picker already shows "from library" in NPC edit + character edit. This filter change makes privately-uploaded portraits appear only to their owner.

---

## Validation gate for Xero

Before building, answer these:

1. **Option A vs Option B for gender/name?** A (schema change, cleaner) or B (gender selection per batch, no migration)?
2. **Any portraits already added via batch upload by non-Thriviers that break with Option A?** (Likely no - batch upload is currently Thriver-only.)
3. **Should bulk-uploaded portraits be immediately visible in OTHER tools** (NPC auto-generate, PortraitBankPicker in character edit)? Or only in the NPC roster?

---

## Phase 3 (not now)
Map placement: bulk-select portraits from the library and place them on the active tactical map as NPC tokens in one action. Post-foundations, as the test plan notes.

---

## Estimated build cost
~2h after schema decision:
- SQL migration (schema change) + apply to live
- Token-creator tab + file queue component
- PortraitBankPicker query update
- `lib/data/portrait-bank.ts` bulk-insert helper
