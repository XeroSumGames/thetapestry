# Test plan - Scene Name field typing fix (2026-05-25)

**Bug:** typing in the SCENE NAME field (scene-controls popout) mangled fast
input ("Storage" -> "Strorg e"). Cause: the field wrote to the DB on every
keystroke, and the popout's `tactical_scenes` realtime subscription echoed each
write back through `load()` -> `setScene`, resetting the field to the lagging
committed value mid-typing.

**Fix:** the input now edits a local `nameDraft` and commits once on blur / Enter;
the draft re-syncs only when the active scene id changes, so realtime echoes never
clobber in-flight typing.

## Steps (GM, on the deployed build)

1. Open a story table -> **Map Setup** (opens the scene-controls popout).
2. In **SCENE NAME**, type a longish name FAST, e.g. `Spring Valley RV & Storage`.
   - Expect: every character lands in order, cursor stays at the end, no
     reordering or dropped letters. Smooth typing.
3. Click away (blur) or press **Enter**.
   - Expect: the name commits once; the scene dropdown + the main-window scene
     label update to the new name.
4. Switch to another scene via the dropdown, then back.
   - Expect: the field shows each scene's correct current name (draft re-seeds on
     scene change).
5. Edit the name, then pick a different scene from the dropdown WITHOUT pressing
   Enter first.
   - Expect: the edit commits on blur as focus leaves the field (name persists).
6. Two-client sanity (optional): with the popout open on one client, have the
   main window nudge Cols/Rows. While that echo arrives, keep typing the name.
   - Expect: typing is NOT interrupted (the echo updates other fields, not the
     name draft).

Revert if wrong: `git revert <this commit>`.
