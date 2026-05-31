# F1 Decision Memo: What does cold `/` show? (2026-05-30)

**North star:** `tasks/north-star.md` - 9/1 Kickstarter; KS = marketing moment;
first impression = conversion.

**The hole, in one sentence:** today a backer who types `thetapestry.distemperverse.com`
(or clicks a KS link to the bare domain) lands on the world-map / ghost-map,
not the `/publiclanding` pitch. The pitch surface exists and is ~80% complete -
but the front door points away from it. Confirmed in the 2026-05-30 visual
pass (`tasks/ks-visual-pass-2026-05-30.md` Surface 2).

**Decision owed (Xero):** which of the four options below. My recommendation
is option A. Validation in 60 seconds is enough; HP wires it in one commit.

---

## Options

### A. Redirect logged-out visitors from `/` to `/publiclanding`. (RECOMMENDED)
- **Wire:** in `app/page.tsx` (or the equivalent route handler), if the visitor
  has no auth session, `redirect('/publiclanding')`. Logged-in users see the
  current map experience unchanged.
- **Pros:** smallest possible change (one server-side redirect); the pitch
  surface already exists; KS link can keep pointing at the bare domain (no
  KS-side change needed); zero risk to existing logged-in users; matches what
  every other product does (Stripe, Linear, Figma all 302 anon to marketing).
- **Cons:** none material. The cold map served no marketing purpose anyway
  (verified in the visual pass: a logged-out backer just saw an empty cyan
  map with no orientation).
- **Risk:** if a current beta playtester has bookmarked `/` and is sometimes
  logged-out (cleared cookies, new browser), they'd land on `/publiclanding`
  instead of straight at sign-in. That is the correct behavior for them too
  (they can click "Sign In" in the footer). NOT a regression.

### B. Keep cold `/` on the map but add a banner CTA pointing to publiclanding.
- **Wire:** in `LayoutShell` (or `app/page.tsx`), if anon, render a banner
  above the map: "New to Tapestry? See what it is ->" linking to `/publiclanding`.
- **Pros:** preserves the cold-map experience if that's somehow load-bearing.
- **Cons:** the cold map isn't load-bearing (the visual pass evidence).
  Banner is a half-measure - real backers ignore banners. Two surfaces to
  maintain instead of a clean redirect.
- **Verdict:** worse than A on every axis.

### C. Redesign cold `/` to BE the marketing landing.
- **Wire:** large. Merge publiclanding into the root, rework LayoutShell to
  show the marketing template for anon and the app shell for logged-in.
- **Pros:** "cleaner" URL.
- **Cons:** large refactor with zero KS-conversion benefit over option A; A
  achieves the same outcome (anon visitor sees the pitch at `/`) via a
  one-line redirect. Don't refactor when redirect is sufficient.
- **Verdict:** premature; revisit post-1.0 if SEO becomes a thing.

### D. KS link points to `/publiclanding` directly; leave cold `/` as-is.
- **Wire:** edit the KS project page once.
- **Pros:** zero code change.
- **Cons:** anyone who hand-types the domain or shares the bare URL still
  lands on the map. Word-of-mouth shares (reviewers tweeting "check out
  thetapestry.distemperverse.com") wouldn't go to the pitch. Half a fix.
- **Verdict:** OK as a stopgap if A is somehow blocked, but A solves the
  whole problem in one commit.

---

## Recommendation: Option A

One server-side redirect in `app/page.tsx` (or wherever the root route lives
post-recent refactor; HP confirms file). Zero risk to logged-in users. Closes
the F1 hole + the visual pass's CRITICAL #1 finding in one commit.

The reason it doesn't need more thought than this: every Kickstarter-style
launch product on the web does some form of A. The cold map isn't a marketing
surface; we don't need to invent one. We already have a marketing surface
(`/publiclanding`); we just need the front door to point at it.

---

## What I need from you (Xero)

Just one of:
- **"Go A"** -> I open a todo line routing the redirect wire to HP with the
  exact one-liner spec; HP ships it in one commit; F1 closes.
- **"Go B / C / D"** -> I update the todo accordingly + scope the wire for HP.
- **"None of the above, here's what I actually want"** -> tell me the shape;
  I'll re-frame.

After this lands, the next #2-workstream blocker is F2 (the visible
`[PLACEHOLDER]` text on `/publiclanding`). That one's pure content, fully
yours - the visual pass enumerates exactly what's missing.

---

## Open variants on A (HP-flavored, low-stakes)

- Should logged-out visitors who arrive with a `?ref=ks` or similar query param
  bypass the redirect (e.g., if you want a future "preview the table without
  signing in" experiment)? Default: no special-case, redirect everyone.
- Should `/login` and `/signup` themselves be exempt from the redirect (so a
  link "Sign in" from `/publiclanding` works)? Yes, by route - the redirect
  only applies to `/`.
- Should `/press` be exempt for anon visitors (reviewers landing there shouldn't
  bounce to publiclanding)? Yes - same logic; the redirect applies to `/` only.

None of these change the A recommendation; they're HP wiring details.
