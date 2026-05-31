# KS First-Impression Visual Pass - 2026-05-30

**North star:** `tasks/north-star.md` - TheTapestry stable/polished/fun for the
9/1 Kickstarter; the KS is a marketing moment, first impression = conversion.

**Method:** Live audit via `Claude_in_Chrome` against
`thetapestry.distemperverse.com` at 1440x900 (typical desktop reviewer/backer
viewport). The "Browser 3" instance turned out to be signed in as Pesky LaRue
(Player), so the cold `/` capture shows the LOGGED-IN ghost-map experience;
the logged-out view would be a similar map without the sidebar (per the F1
todo line + `app/page.tsx` routing). Surfaces audited: `/publiclanding`,
`/`, `/signup`. `/press` and the new-GM dashboard left for a follow-up pass.

**Audit lens:** Senior product / UX / business operator hat, against the
Kickstarter conversion bar: does a backer arriving cold understand within
5 seconds (a) what this is, (b) why they should care, (c) what to do next.
Bug-for-bug fidelity to today's build, not a redesign.

---

## Surface 1: `/publiclanding`

### What's there (works)
- **Hero typography lands.** "CURRENTLY IN BETA" tag + "THE TAPESTRY" hero + the
  one-line tagline ("A platform for the DistemperVerse - campaigns, characters,
  communities, and shared world-state across every story.") - good scale, good
  rhythm, instantly readable at 1440. Distemper red accent against the dark
  surface reads as "considered" not "default Bootstrap".
- **Two-CTA shape is right.** Primary "REQUEST BETA ACCESS" (red) + secondary
  "PRESS KIT" (outline) is the correct 1-of-1 / 1-of-1 split for the current
  pre-launch posture.
- **Bottom CTA echoes the top.** "READY TO ROLL?" with the same primary button
  closes the page cleanly - a real backer who scrolled to the bottom has the
  same single decision in front of them.
- **Footer minimum-viable.** Press Kit / Rules / Sign In + copyright. Nothing
  redundant.

### What blocks KS-bar (gaps)
- **`[PLACEHOLDER]` text is RENDERED in the live page**, visible to any cold
  visitor TODAY (4 paragraphs across "What is Tapestry?" + "Who is it for?",
  plus 3 `[SCREENSHOT PLACEHOLDER]` boxes under "What it looks like"). This is
  the single biggest KS-conversion risk on the site right now - a reviewer or
  backer landing here in the next 90 days reads "[PLACEHOLDER]" and bounces.
  Routed: **F2** (Xero content -> HP wires).
- **The CTA is BETA-framed, not KS-framed.** "Request Beta Access" works for
  beta-500 7/1, but the KS opens 9/1. There is no "Back the Kickstarter" /
  "Get notified when we launch" / countdown / email capture for KS interest.
  Routed: **F1 + F2** (decision: what should the KS CTA say + where does it go;
  Xero copy; HP wires).
- **No "what makes this different?" hook above the fold.** The tagline ("a
  platform for the DistemperVerse...") describes WHAT the platform is, not WHY
  someone should pick it over Roll20 / Foundry / Owlbear / a notebook. A KS
  backer is shopping; they need a differentiator in the first sentence. Routed:
  **F2** (Xero copy).
- **"In-session table / Character sheet / Community dashboard" preview cards
  are empty boxes.** These are the visual proof. Screenshots or - better for KS
  - a 30-60s autoplay video loop is the single highest-leverage addition. Routed:
  **F2** (Xero assets + maybe a small HP wire for video).
- **No social proof anywhere.** No playtester quotes, no GM count, no
  campaign-count "we ran 47 sessions in beta" - nothing that says "real
  humans use this." For a tabletop product especially, this matters. Routed:
  **F2** (Xero content; once Beta-500 has 2-3 weeks of data, this becomes
  trivial to populate).

### What's NOT a problem (intentionally noting, so this doesn't get re-litigated)
- The Distemper-red on dark works for the IP; do NOT chase a generic SaaS
  palette.
- "DistemperVerse" as the brand umbrella reads fine in the tagline; no need
  to over-explain it inline (the page has a "What is Tapestry?" section
  immediately below for that).

---

## Surface 2: cold `/`

### What's there
Browser 3 was logged in as Pesky LaRue, so what I observed is the LOGGED-IN
ghost-map view: the world-map (cyan blank tiles - tiles failed to load in this
capture, possibly a CDN hiccup or a stale auth-something), the full sidebar
(A Guide to the Tapestry / The World / My Survivors / My Stories / My
Communities / The Campfire / Rumors / The Rules / The DistemperVerse), and
the right-side Pins panel. For a true logged-out (ghost) visitor the sidebar
collapses but the map surface stays, per `app/page.tsx` routing.

### What blocks KS-bar (the core gap)
- **The bare domain shows the world-map, NOT `/publiclanding`.** A backer who
  types `thetapestry.distemperverse.com` (or who clicks a KS link that goes
  to `/`) never sees the pitch. This is the single most damaging miss on the
  site for the KS funnel - the pitch surface exists and is ~80% complete, but
  the front door points away from it. Routed: **F1** (Xero decision + HP
  wiring; the decision is binary and overdue).
- **Map tiles failed to render in this capture** (all panes are flat cyan).
  Worth confirming whether this is a Browser-3-specific cache state, a
  build-specific regression, or a "tiles are slow under load" symptom. NOT
  routed yet - need a re-capture in a fresh browser to know if it's real.
  **TODO for this lane:** re-check on a fresh ghost browser pass.
- **Sidebar surface area is high for a logged-in user landing cold from a
  KS link.** Even if they DID intend to sign in, "A Guide to the Tapestry"
  is buried among 9 sidebar items - a first-time GM has no orientation hint.
  Routed: **F4/F5** (HP/UX - new-GM first-action polish).

---

## Surface 3: `/signup`

### What's there (works)
- **Form is the right shape.** Username + Email + Password + primary red "SIGN
  UP" + log-in link. Three fields is the right count for a free beta. No
  CAPTCHA visible = the off-screen-invisible Turnstile fix from `5f73bfb` is
  doing its job correctly (verified live - no "bot check failed" regression).
- **Centered, calm, dark.** Reads as intentional, not under-designed.

### What blocks KS-bar (gaps)
- **"Join the DistemperVerse" subhead is too vague for a KS-driven funnel.** A
  visitor arriving from a Kickstarter link needs immediate reassurance they're
  in the right place: "Beta-500 closed-access signup" / "We'll email you when
  Kickstarter goes live" / something concrete. Routed: **F2** (Xero copy; HP
  one-liner wire).
- **No expectation-set above the form.** What happens after they hit SIGN UP?
  Today they get a "CHECK YOUR EMAIL" screen (per the 2026-05-27 verified
  flow), but the form doesn't tell them that in advance. A KS visitor wants
  the friction-shape up-front. Routed: **F2 + HP** (small copy line above the
  form: "We'll email a confirmation link. Beta-500 access is gated; you'll be
  on the list."). Could ship as a 2-line HP wire today; not blocking.
- **No "what is this?" escape hatch.** A confused KS visitor lands on /signup
  with no context-set and can't easily get to `/publiclanding` to read the
  pitch (no header, no back-to-home link in the visible area). The page is
  popout-shaped per `AGENTS.md` (`LayoutShell` suppresses sidebar on
  `-sheet`/`-popout` and similar), and `/signup` inherits that. Add a small
  "About Tapestry ->" link below "Log in". Routed: **HP minor** (or roll into
  **F4/F5**).

---

## Severity ranking (ship-order for the KS conversion floor)

1. **CRITICAL** - The cold `/` -> map routing (**F1**). A backer who types the
   bare URL never reaches the pitch. Decide + wire ONCE; everything else is
   noise until this is fixed.
2. **CRITICAL** - The visible `[PLACEHOLDER]` text on `/publiclanding`
   (**F2**). Today's live page reads "[PLACEHOLDER]" four times. This is a
   trust-killer specifically because the rest of the page LOOKS finished, so a
   reviewer assumes the placeholders are the level of polish you ship.
3. **HIGH** - KS-framing of the CTAs across the funnel (**F2 + F1 decision**).
   The current "Request Beta Access" copy is right FOR NOW but needs a path to
   "Back the Kickstarter" / "Get notified" between now and 9/1.
4. **HIGH** - Screenshots / autoplay-video in the "What it looks like" cards
   (**F2 assets**). The single highest-leverage visual proof, and the empty
   boxes today read as unfinished.
5. **MEDIUM** - Signup subhead + expectation-set (**F2 copy + HP wire**, tiny).
6. **MEDIUM** - Social proof on `/publiclanding` (**F2**, defer until beta data
   exists).
7. **LOW** - "About Tapestry" escape hatch from `/signup` (**HP minor**).
8. **OPEN QUESTION** - cyan map-tile rendering issue on cold `/` capture - may
   be ephemeral; re-check on a fresh ghost browser before routing as a real
   bug. Lane action: re-do this pass with a logged-out browser when possible.

---

## What this audit did NOT cover (gaps to close)

- **`/press`** - skipped this pass; should get the same treatment before KS
  outreach starts.
- **True logged-out / ghost cold `/`** - Browser 3 was Pesky-signed-in; re-run
  with an incognito or freshly-signed-out browser to confirm the F1 routing
  symptom from a real-visitor perspective.
- **New-GM dashboard** - requires a fresh GM account (or the GM browser pre-
  loaded with a brand-new campaign); the look/feel-after-signup is the second-
  most-important first impression after `/publiclanding`. Routed: **F4/F5** as
  the existing todo line + this pass owes the actual capture.
- **Mobile viewport (375x812)** - desktop-only this pass. Mobile is a separate
  follow-up.

---

## Closure

Findings above route into the existing F1-F6 todo lines (no new
top-level items). The lane action that closes this audit is to re-do
the cold-`/` capture on a true ghost browser before routing the
cyan-tile observation; everything else is a content/copy/wire ask
already owned by F1-F6.
