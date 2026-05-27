# KS First-Impression Audit (pass 1) - 2026-05-27

**Author:** Puffer Fish. **Serves:** the north-star #2 workstream - "stable, **polished, fun**; looks great, intuitive, lots to explore, must feel promising" for the **9/1 Kickstarter**. A backer's first five minutes decide whether they fund; this audit hunts the gaps in that path.

**Method:** code-level walk of the cold-visitor funnel. **A live VISUAL pass (screenshots of each surface on prod) is the necessary follow-up** - "does it look great" can't be fully judged from code. This pass finds the structural / framing / dead-end gaps.

**Owner tags:** `[XERO]` = content / copy / assets / a product decision (his lane); `[HP]` = code/UX wiring (Hunt & Peck). Most landing polish is a Xero-supplies-content + HP-wires split.

## The funnel a cold KS backer actually hits
1. Clicks the KS link -> **either** the bare domain `/` **or** `/publiclanding` (UNDECIDED - see F1).
2. `/` (= `app/page.tsx` -> `DashboardPage`): logged-out -> renders `<MapView embedded>` ("ghost landing - map directly, ghost wall triggers on interaction"). **Not** the marketing page.
3. `/publiclanding`: the polished hero/pitch page - but only seen if linked there explicitly.
4. Signup (`/signup`) -> redirects to `/dashboard` (the map) + a dismissible `WelcomeModal` (shows once, `profile.onboarded` flips on dismiss). `/firsttimers` + `/welcome` are re-readable guides.

## Findings (prioritized for 9/1)

### P1 - the KS landing itself (highest stakes)
- **F1 [XERO decision + HP wiring] What does the KS link point to, and what does `/` show a cold visitor?** Today `/` drops logged-out visitors into the ghost MAP, not `/publiclanding`. So a backer who types the bare domain may never see the pitch. Decide: (a) KS link -> `/publiclanding` directly AND/OR (b) `/` routes cold/logged-out visitors to `/publiclanding`. Pick one; HP wires it. Right now it's implicit/accidental.
- **F2 [XERO content, then HP wires] `/publiclanding` is an explicit DRAFT** (`app/publiclanding/page.tsx` header: "DRAFT 2026-05-20. Placeholder copy and screenshot boxes. Real copy + assets ... before 2026-06-15"). It has **placeholder copy, empty screenshot boxes**, **beta framing** ("Currently in Beta", CTA "Request Beta Access"), and a **stale 6/15 launch date**. For 9/1 this needs: real hero copy, real screenshots/video, **Kickstarter framing + a "Back us on Kickstarter" CTA**, and the date/launch-plan refs updated (7/1 beta -> 9/1 KS). This is the #1 conversion surface and it's a stub.
- **F3 [Puffer, quick] stale launch refs:** `publiclanding` + `tasks/launch-plan-2026-06-15.md` reference a 6/15 launch that no longer exists. Reconcile to the north-star timeline (7/1 beta / 9/1 KS). (I can do the doc/date side.)

### P2 - the first five minutes (the "promising + intuitive" bar)
- **F4 [HP/UX + live-visual] The cold `/` ghost-map landing** is an intentional "show the living world" play - good instinct - but it must (a) look great and (b) make "what is this + how do I get in / back the KS" obvious. Validate on the live site: is the ghost wall inviting or a confusing dead-end? Is there a clear value-prop + CTA overlay, or just a map with no context? (Needs the visual pass.)
- **F5 [HP/UX] New-GM next-action.** After signup a new GM lands on the dashboard MAP + a one-time `WelcomeModal`, then... what pulls them to "create your first campaign / run a free module (Empty, The Arena)"? Confirm there's an obvious, guided first action, not a stall on an empty map. (The north star's GM-first-run is the core funnel - free content is the hook.) Validate live.

### P3 - polish / maintenance
- **F6 [HP, minor] `WelcomeModal` duplicates `/firsttimers` content** (`WelcomeModal.tsx:15` "Content mirrors /firsttimers ... kept duplicated"). Single-source it so onboarding copy can't drift. Low priority.

## Next step
**The live VISUAL pass** - screenshot `/publiclanding`, cold-`/` (ghost map), `/signup`, and the post-signup new-GM dashboard on prod, and judge the actual look/feel against the KS bar (this is where "looks great / feels promising" is really assessed). Puffer can drive it with the browser tool, or it's a natural thing for Xero + a fresh-eyes reviewer. The biggest blocker to a great KS landing is **content** (F2 - real copy + assets), which is Xero's to supply; everything else is wiring + polish.
