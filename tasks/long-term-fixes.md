# Long-term fixes

Items that aren't blocking and have been deferred from the
last-minute-fixes / playtest queue. Pick up when there's time
and a clear repro.

---

## Tactical map pan via mouse drag

**Status:** broken. Click-and-drag on an empty cell doesn't scroll the
map even when the canvas overflows the container.

**History:**
- Multiple attempts have shipped: rAF coalescing, GPU layer promotion
  (translateZ), `contain: layout paint`, window-level mouse listeners,
  reverted back to React-handler approach. None fully solved it.
- The arrow-key / WASD pan path works fine (different code path,
  fires `containerRef.current.scrollLeft +=` directly via rAF).
- Spacebar override (mousedown while spaceHeld) is the higher
  priority and is being addressed separately under last-minute #2.

**Likely causes to investigate next:**
- The canvas may not actually overflow the container at typical
  zoom levels — `containerRef.current.scrollLeft` writes have no
  effect when there's nothing to scroll. Verify with devtools.
- `contain: layout paint` interaction with `overflow: auto` may
  need re-evaluation.
- Possibly the canvas needs explicit `width: ${px}px; height: ${px}px`
  styling to force the container to know its overflow size, rather
  than relying on `canvas.width/height` attributes alone.

**Workaround for now:** use arrow keys / WASD to pan. Or zoom out
to fit-screen and don't pan.

**Deferred 2026-04-27** post-playtest, per user.
