# Rules / Communities test plan — 2026-05-01

Test page: `/rules/communities` (long-page-with-anchors style, Blades reference structure).

## 1. Sidebar wiring

- [ ] Open Tapestry — confirm the **Rules** entry in the sidebar is now an active link (no longer dimmed "soon" text).
- [ ] Click **Rules** — lands on `/rules` showing the section grid.
- [ ] Confirm the Equipment item below Rules still shows as "soon" (we only swapped Rules).

## 2. Public access (no login)

- [ ] Sign out of Tapestry.
- [ ] Hit `https://thetapestry.distemperverse.com/rules` directly — page loads without the login redirect.
- [ ] Hit `https://thetapestry.distemperverse.com/rules/communities` directly — also loads.
- [ ] Try a deep anchor: `https://thetapestry.distemperverse.com/rules/communities#apprentices` — page loads AND scrolls to the Apprentices heading.
- [ ] Sign back in. Open `/rules/communities` — same page, no double-render or auth flicker.

## 3. /rules landing

- [ ] 13 cards visible: Overview, Core Mechanics, Character Overview, Character Creation, Skills, Combat, Equipment, **Communities**, Appendix A–D.
- [ ] All cards except **Communities** show "§NN · forthcoming" in grey.
- [ ] Communities card shows "§08" in red (the accent color reserved for live content).
- [ ] Click any card — lands on the matching `/rules/<slug>` page.

## 4. /rules/communities content (the test page)

- [ ] Hero: red eyebrow "§08 · COMMUNITIES" + huge "COMMUNITIES" title + intro paragraph mentioning the 13-member threshold.
- [ ] Skim the page top-to-bottom. Sections present in this order:
  1. Group vs Community
  2. Recruitment Check
  3. Cohort outcomes
  4. Conscript outcomes
  5. Convert outcomes
  6. Apprentices
  7. Morale Check
  8. Morale Modifiers
  9. Morale Outcomes
  10. Dissolution & Retention
  11. Community Structure
  12. Gatherers — Fed Check
  13. Maintainers — Clothed Check
  14. Safety
  15. PC contribution
  16. Distemper CRB additions (Inspiration, Inspiration Lv4, Psychology* Lv4)
- [ ] Tables render readably — confirm at least one of each: outcomes table (Cohort), Morale modifier slot table, Morale outcomes (with the **Next Mood** column), structure table.
- [ ] Wild Success and Moment of High Insight rows have a subtle dark-red left-border highlight (the `emphasized` style).

### 4a. Specific facts to verify (catches OCR / transcription bugs)

- [ ] **Apprentice unlock** — only on **Moment of High Insight (6+6)**. Wild Success alone does NOT unlock. (Test page §6).
- [ ] **Apprentice CDP** — 3 CDP RAPID, 5 CDP skills, one Paradigm. Training cap is **PC skill level − 1** over **1 month** game-time.
- [ ] **Morale outcomes** — six rows. Moment of Low Insight = **75% leave, −3 Mood**. (Spec was missing this previously.)
- [ ] **Fed Check Wild Success** — shows **+1**, NOT −1. (PDF OCR garbled this; the rendered page must show +1.)
- [ ] **Dissolution** — page mentions both the 3-strike rule AND the immediate retention Morale Check using the failed result as Mood.
- [ ] **Enough Hands** — text says "+1 if all three meet minimums; −1 per group short, max −3" (the page shouldn't only show the negative case).
- [ ] **Inspiration Lv4** = +4 to Morale. **Psychology* Lv4** = +3 to Morale.

## 5. Sticky left-rail nav (RulesNav)

- [ ] On `/rules/communities`, the left rail shows all sections, with "08 Communities" expanded inline.
- [ ] Inactive sections (Overview, Combat, etc.) show only their section title.
- [ ] Click "01 Overview" in the left rail — navigates to `/rules/overview`. Once there, Overview's anchors expand and Communities' collapse.
- [ ] Top of rail: "XSE SRD v1.1" header in red, links back to `/rules`.

## 6. Anchor highlighting (IntersectionObserver)

- [ ] On `/rules/communities`, scroll slowly down the page.
- [ ] As each H2 passes the upper-third of the viewport, the matching anchor in the left rail highlights (left blue accent border + brighter text).
- [ ] The highlight always tracks the section currently visible — never lags behind by more than one heading.
- [ ] Click an anchor in the left rail (e.g. "Morale Check") — page scrolls to that heading (with a small top-margin so the heading isn't flush against the very top).
- [ ] Browser back-button works after clicking anchors (history entries created by `<a href="#…">`).

## 7. Try-it cross-links

- [ ] Inside "Group vs Community", "Recruitment Check", "Apprentices", and "Morale Check" sections there's a "Try it →" callout (blue left border).
- [ ] Click each — lands on the relevant live tool:
  - Group vs Community → `/communities`
  - Recruitment → `/communities`
  - Apprentices → `/characters/new`
  - Morale → `/communities`

## 8. Visual / typographic checks

- [ ] Body text is Barlow 17px (matches `creating-a-character`).
- [ ] All headings are Carlito uppercase, letter-spaced, with the size hierarchy visible (eyebrow 13 → H3 18 → H2 28 → H1 48).
- [ ] No inline font-size between 9–12px anywhere on the page (run `node scripts/check-font-sizes.mjs` to confirm).
- [ ] Background `#0f0f0f`, no white flashes between sections.
- [ ] No overlap or visible scroll artifact between the global Tapestry sidebar and the new RulesNav.

## 9. Wix export script (Strategy B)

- [ ] After this PR is on production, run: `node scripts/build-rules-html.mjs`
- [ ] Confirm `out/wix-rules/` contains 13 HTML files (index + 12 sections).
- [ ] Open `out/wix-rules/communities.html` in a browser locally — content renders standalone with the Tapestry typography preserved.
- [ ] Inspect a link in that file (e.g. an anchor inside the Recruitment cross-link card) — `href` is absolute (`https://thetapestry.distemperverse.com/communities`), not relative.
- [ ] On xerosumgames.com Wix editor: create a "Rules — Communities" page, drop in an HTML-embed block, paste the contents of `communities.html`. Preview — content renders, all cross-links go to the live Tapestry site in a new tab.
- [ ] Repeat for any other section once that section gets its real content.

## 10. Granularity comparison (chosen vs alternative)

After living with `/rules/communities` for a session or two, ask:

- [ ] Did ⌘-F across the whole page beat what a paginated version would have given me? (If yes — keep one-long-page.)
- [ ] Did anyone hit the page from a Google search for a specific subsystem (e.g. "Distemper Conscript")? (If yes, and they bounced because it took too long to scroll to the answer — consider switching that one section to many-short-pages later. The data lives in `lib/rules/sections.ts` so the split is mechanical.)

---

## Known follow-ups (not part of this test)

- Eventual MDX migration: convert `app/rules/communities/page.tsx` to `content/srd/communities.mdx` + a single page renderer. Mechanical conversion once `@next/mdx` is added.
- 11 stub pages need real content from SRD §01–§07 + Appendices A–D.
- Search across rules: deferred to v2 (⌘-F is enough today).
