# KS First-Impression Visual Pass 2 - 2026-05-30

**North star:** `tasks/north-star.md` - 9/1 KS; first impression = conversion.

**Continues from pass 1** (`tasks/ks-visual-pass-2026-05-30.md`). Pass 1
covered `/publiclanding` + cold `/` + `/signup` at 1440x900. This pass tackles
the gaps named in pass 1 § "What this audit did NOT cover". `Claude_in_Chrome`,
Browser 3 (signed in as Pesky), prod.

Surfaces in scope: `/press`. Surfaces deferred (need state I don't have):
true ghost cold `/` (need a logged-out browser), new-GM dashboard (need a
fresh GM session), and a real mobile viewport (the `resize_window` MCP call
resizes the OS window but does NOT change the rendering viewport - "mobile"
screenshots came back at 1568x744 with the desktop layout; not a real test).

---

## Surface 1: `/press`

### What's there (works)
- **Hero shape is correct.** "PRESS KIT" eyebrow + "THE TAPESTRY" hero + one-line
  tagline. Press-kit convention; reviewers will recognize the layout.
- **"Back to landing" escape hatch** at the top - small but right; a reviewer
  who clicks the press link from a search result has an obvious way back to
  the pitch.
- **QUICK FACTS table is the right shape.** Product / Setting / Status /
  Pricing / Platform / URL / Founded - exactly the row set press kits use.
- **SCREENSHOTS section** (5 cards: In-session table view / Tactical map with
  tokens / Character sheet / Community dashboard / Campaign world map) - good
  card choices for press use; the cover note ("Click to download full-
  resolution. Free to use in articles and videos with credit.") is the right
  legal posture.
- **LOGOS section** with 4 variants (Primary mark / Wordmark / Monochrome /
  Social square) - shows you've thought about press needs beyond just the
  page itself.

### What blocks KS-bar (gaps)
- **`[PLACEHOLDER]` text rendered in 5+ places.** Same trust-killer class as
  pass 1's finding on `/publiclanding`:
  - Quick Facts: `Pricing: [PLACEHOLDER] Free during beta. Paid tiers planned post-launch.`
  - Quick Facts: `Founded: [PLACEHOLDER year + founder name]`
  - About paragraph 1: `[PLACEHOLDER paragraph 1] The Tapestry is...`
  - About paragraph 2: `[PLACEHOLDER paragraph 2] The DistemperVerse is...`
  - About paragraph 3: `[PLACEHOLDER paragraph 3] Tapestry is in beta as of 2026-05-20...`
  - Founder bio: `[PLACEHOLDER bio - 1 paragraph...]`
  - Logos: `[PLACEHOLDER - link to ZIP containing: PNG (transparent), SVG, ...]`
  - 5 screenshot cards: all `[PNG PLACEHOLDER]`
  - 4 logo cards: all `[LOGO]`
  Routed: **F2 (Xero content -> HP wires)** - same class as the publiclanding
  placeholders, same kind of fix; the cover note ("free to use in articles")
  becomes literally dangerous once real assets are in place (reviewers WILL
  use whatever's there).
- **Stale "2026-05-20" date in the About paragraph 3 body.** This is rendered
  copy, not a dev comment (so the F3 sweep I shipped earlier doesn't catch
  it). The body says `Tapestry is in beta as of 2026-05-20, with an active
  playtester group and limited public availability via invite.` That date
  is stale (it's now 2026-05-30; beta-500 opens 2026-07-01). Routed: **F2**
  (Xero copy update for the beta status line; or a small HP wire to read
  beta status from a config constant - probably overkill for a press kit).
- **First-paint timing oddity.** The first screenshot after navigation was
  completely black (no content rendered); the content appeared after a
  scroll. Likely a hydration / scroll-into-view animation that runs on first
  render. Reviewers on slow connections or with reader/AT might see nothing.
  **Worth a code check** - if the page uses `IntersectionObserver` reveal-
  on-scroll for sections that include the hero, a reviewer who lands and
  doesn't scroll sees a blank page. Routed: **HP investigation** - inspect
  `app/press/page.tsx` for opacity/transform animations gated on scroll;
  the hero MUST render on first paint.
- **No press-contact email visible above-the-fold** (the page promises "press
  inquiries at the contact email below" in the About paragraph 3, but the
  email isn't placed where a busy reviewer would skim for it). Routed: **F2
  + HP** - lift the contact email into the QUICK FACTS table.

### What's NOT a problem
- The press-kit "quick facts" table structure is correct; no need to change
  it. Just fill the placeholders.
- The legal posture ("free to use with credit") is the right default for KS
  pre-launch.

---

## Surfaces deferred (need state I don't have)

### True ghost cold `/`
Browser 3 was signed in as Pesky, so the cold `/` screenshot in pass 1 was a
logged-in ghost-map experience, not a true logged-out view. The F1 routing
finding (cold `/` doesn't show the pitch) stands regardless - it was proven
by the `app/page.tsx` route inspection + the existing F1 todo. But the
visual-experience side ("what does a real backer see in the moment they
arrive?") deserves a re-capture in a logged-out browser. Needs Xero to point
at a fresh browser OR sign Browser 3 out (risk: disrupts whoever's using
Pesky's session).

### New-GM dashboard (post-signup)
The second most important surface after `/publiclanding` for KS conversion -
it's what a freshly-signed-up backer sees right after they confirm their
email. Capturing it requires a brand-new GM account with no campaigns. Needs
Xero to (a) point at a GM browser with a never-played-in account, or (b)
walk through a fresh signup so I can capture the post-signup landing.
Routed: tracked in the existing F4/F5 todo line.

### Mobile (390x844 / 375x812)
`resize_window` resizes the OS window but does NOT change the rendering
viewport - all 4 "mobile" screenshots came back at 1568x744 with the desktop
layout. Inspection of the source confirms both `/publiclanding` and `/press`
use `gridTemplateColumns: 'repeat(auto-fit, minmax(260-280px, 1fr))'` -
which DOES collapse to single-column at narrow widths by design. So mobile
behavior is probably fine, but I can't visually confirm it. Real mobile pass
needs either a real device or a browser-side devtools emulation toggle (not
exposed via `Claude_in_Chrome` MCP).

---

## Severity ranking (combined with pass 1)

Reusing pass 1's ladder; pass 2 findings slot in:
1. **CRITICAL** - cold `/` -> map routing (F1). Pass 1.
2. **CRITICAL** - `[PLACEHOLDER]` text on `/publiclanding` (F2). Pass 1.
3. **CRITICAL** - `[PLACEHOLDER]` text on `/press` (F2 extension). **Pass 2.**
   Same class as #2; reviewers are the target audience here; placeholders
   that ship to a reviewer are quoted IN the article.
4. **HIGH** - KS-framing of CTAs. Pass 1.
5. **HIGH** - Screenshots / autoplay-video on `/publiclanding`. Pass 1.
6. **HIGH** - Screenshots / logo ZIP on `/press`. **Pass 2** (5 PNG +
   4 logo + 1 ZIP placeholders; rolls into F2 asset delivery).
7. **MEDIUM** - First-paint timing oddity on `/press` (blank black on
   initial render). **Pass 2.** Investigate before any reviewer is sent the
   link.
8. **MEDIUM** - Signup subhead + expectation-set. Pass 1.
9. **MEDIUM** - Stale "2026-05-20" date in `/press` About copy. **Pass 2**
   (F2 copy).
10. **MEDIUM** - Social proof on `/publiclanding`. Pass 1.
11. **MEDIUM** - Press contact email lifted into QUICK FACTS. **Pass 2.**
12. **LOW** - "About Tapestry" escape hatch from `/signup`. Pass 1.

---

## Closure

All pass 2 findings route into the existing F1-F6 todo lines (no new
top-level items). Pass 3 owed when Xero supplies the deferred-surface state
(logged-out browser for ghost `/`, fresh GM for the post-signup dashboard, a
real mobile device for the responsive verification).
