# Test Plan — Comic Reader Popout

Shipped 2026-04-30. Adds a `reader_mode` discriminator to campaign_pins. When set to 'comic', the pin gets a 📖 button that opens a page-flip popout backed by the pin's image attachments.

## Pre-flight

Apply migration in Supabase SQL editor:
- [sql/campaign-pins-reader-mode.sql](../sql/campaign-pins-reader-mode.sql)

Verify:
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'campaign_pins' AND column_name = 'reader_mode';
-- expect 1 row
```

## Setup a comic pin

1. In a campaign, open `/stories/[id]/table` and the Pins tab.
2. Edit (or add) a pin — name it "The Greatest City on Earth" or similar.
3. In the edit form, tick **📖 Comic reader — pages = sorted image attachments**. Save.
4. Re-edit the pin (so we're in expanded mode) — drag-drop or upload a handful of image files onto the pin. Name them `001.jpg`, `002.jpg`, … so they sort naturally.
5. Save.

## Golden path — open + flip

1. The pin row should now show **📖** as the first action button (purple, before Edit / 🌍 / ×).
2. Click 📖.
3. **Expected**: a popout window opens (980×1100) showing the comic reader.
   - Top bar: 📖 + pin name on the left, page counter "1 / N" on the right, Fit / Single|Spread / ⛶ / ✕ buttons.
   - Page 1 image rendered fit-to-height by default, centered.
   - Bottom bar: ← Prev · slider · Next →.
4. Click the right half of the page → flips to page 2. Click the left half → back to 1.
5. Press →, j, PageDown, or Space → forward. ←, k, PageUp → back. Home → first. End → last.
6. Drag the slider in the bottom bar → jumps to that page.
7. Click **Fit: Height** → flips to **Fit: Width**. Page resizes accordingly.
8. Click **Single** → flips to **Spread**. Two pages render side-by-side; ← and → step by 2.
9. Click **⛶** or press F → fullscreen. Press F or Esc to exit (Esc also closes the window).

## Edge — natural page sort

1. Upload pages named `1.jpg`, `2.jpg`, … `10.jpg`, `11.jpg`.
2. **Expected**: order is 1 → 2 → … → 10 → 11. Not lexicographic 1 → 10 → 11 → 2.

## Edge — pin without reader_mode

1. Find a regular non-comic pin.
2. **Expected**: no 📖 button on its row. Edit / 🌍 / × only.

## Edge — pin with reader_mode but no image attachments

1. Toggle the comic flag on a pin that has zero image attachments.
2. Click 📖.
3. **Expected**: reader popout opens with "No pages found. Upload images to this pin's attachments to populate the reader." Close button still works.

## Edge — reader_mode toggled off

1. Edit the comic pin, untick **Comic reader**, save.
2. **Expected**: the 📖 button disappears from the pin row. (The image attachments stay — they're just no longer reachable through the reader UI.)

## Idle chrome auto-hide

1. Open the reader, sit still for ~3 seconds.
2. **Expected**: top + bottom toolbars fade out.
3. Move the mouse — toolbars fade back in.
4. Any keyboard input also brings them back.

## Spread on odd-page count

1. Comic with 7 pages, Spread mode, currently showing pages 1–2.
2. Click Next twice → pages 3–4 → 5–6.
3. Click Next → pages 7 only (no page 8 exists, second slot is empty).
4. **Expected**: no crash, just one image displayed; Next button greys out.

## Regression — other pin actions

1. The Edit, 🌍 (or 🗺️ in tactical), × buttons should still work as before regardless of reader_mode setting.
2. The category icon picker should still save independently of the reader_mode toggle.
