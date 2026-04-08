# Test Plan: Creating-a-Character links open in new window

## What changed
Added `target="_blank"` and `rel="noopener noreferrer"` to all six character creation links on the `/creating-a-character` page so they open in a new browser tab.

## Steps to test
1. Navigate to `http://localhost:3000/creating-a-character`
2. Click the **Backstory Generation →** card button — should open `/characters/new` in a new tab
3. Click the **Quick Character →** card button — should open `/characters/quick` in a new tab
4. Click the **Random Character →** card button — should open `/characters/random` in a new tab
5. Scroll to the bottom CTA section
6. Click **Start Backstory Generation** — new tab
7. Click **Quick Character** — new tab
8. Click **Random Character** — new tab
9. Confirm the `/creating-a-character` page remains open after each click
