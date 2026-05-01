# XSE SRD Web Reference — Sketch

**Source of truth**: `docs/Rules/XSE SRD v1.1.17 (Small).pdf` (gitignored, local-only). Pre-digested extracts live in `tasks/rules-extract-*.md` and supersede direct PDF re-reads when present.

**Style chosen**: One long page per major section, with anchored H2/H3 subsections (Blades-in-the-Dark style). Many-short-pages remains an option if Google SEO turns out to matter more than ⌘-F across a whole subsystem.

**Two homes**:
- **Tapestry** — `thetapestry.distemperverse.com/rules` (public, sidebar `Rules` link)
- **xerosumgames.com** — Wix site, **Strategy B**: a build script (`scripts/build-rules-html.mjs`) emits standalone HTML per page; user pastes into Wix HTML-embed blocks. Manual paste on each update — acceptable for a doc that ships infrequently.

**Live cross-links**: YES. Rule anchors deep-link to the live Tapestry tool that implements them. On Wix, the same anchors become external links to `thetapestry.distemperverse.com/...`.

---

## 1. Sitemap

| Route | Source section | Approx length | Status |
|---|---|---|---|
| `/rules` | Landing — section index + intro | short | v1 |
| `/rules/overview` | §01 Overview | short | v1 stub |
| `/rules/core-mechanics` | §02 Core Mechanics | medium | v1 stub |
| `/rules/character-overview` | §03 Character Overview | medium | v1 stub |
| `/rules/character-creation` | §04 Character Creation | long | v1 stub |
| `/rules/skills` | §05 Skills | medium | v1 stub |
| `/rules/combat` | §06 Combat | long | v1 stub |
| `/rules/equipment` | §07 Weapons & Equipment | medium | v1 stub |
| **`/rules/communities`** | **§08 Communities** | **long** | **TEST PAGE — full content** |
| `/rules/appendix-tables` | Appendix A | reference | v1 stub |
| `/rules/appendix-skills` | Appendix B | reference | v1 stub |
| `/rules/appendix-equipment` | Appendix C | reference | v1 stub |
| `/rules/appendix-paradigms` | Appendix D | reference | v1 stub |

V1 stubs exist as routes with their TOC but with `(content forthcoming)` placeholders so the nav structure is testable end-to-end without 404s.

---

## 2. /rules/communities — anchor map

Drawn from `tasks/rules-extract-communities.md` §1–§5 (which is itself canonical relative to the SRD PDF, with errata applied).

```
#overview                  Group vs Community (13+ threshold)
#recruitment               Recruitment Check overview
#recruitment-cohort          Cohort outcomes
#recruitment-conscript       Conscript outcomes
#recruitment-convert         Convert outcomes
#apprentices               Apprentice rules + creation
#morale                    Morale Check overview
#morale-modifiers            Mood / Fed / Clothed / Enough Hands / Clear Voice / Watch Over / Adjusted
#morale-outcomes             6 outcome rows + next-week Mood CMod
#dissolution                 3-strike dissolution + retention check
#structure                 Community Structure (role minimums)
#structure-gatherers         Gatherers — Fed Check
#structure-maintainers       Maintainers — Clothed Check
#structure-safety            Safety
#structure-pc-help           PC contribution to Fed/Clothed
#crb-additions             Distemper CRB additions (Inspiration Lv4, Psychology* Lv4)
```

---

## 3. Cross-link map (anchor → live tool)

| Anchor | Live link | Why |
|---|---|---|
| `#overview` | `/communities` | Jump straight to the user's communities |
| `#recruitment` | `/communities/[id]` → Recruit modal | Try it for real |
| `#apprentices` | `/characters/new` (Apprentice flow TBD) | Cross-link to character creation; Apprentice creation lives there |
| `#morale` | `/communities/[id]` → Weekly Morale modal | Try it for real |
| `#structure` | `/communities/[id]` → Members tab | See role assignments |
| `#crb-additions` | `/rules/skills#inspiration` and `/rules/skills#psychology` | Internal SRD cross-refs |

On Wix, the same anchors are absolutized to `https://thetapestry.distemperverse.com/communities` etc. — outbound links from the marketing site to the live tool.

---

## 4. Layout

**Tapestry shell** stays on the outermost left (existing `Sidebar.tsx`). Inside the rules viewport, two columns:

```
┌───────────┬─────────────────────────┬──────────────────────────────────┐
│ TAPESTRY  │  RULES NAV (sticky)     │  CONTENT (scrolling)             │
│ SIDEBAR   │                         │                                  │
│ (existing)│  • Overview             │  # COMMUNITIES                   │
│           │  • Core Mechanics       │  Eyebrow / hero / intro          │
│           │  • Character Overview   │                                  │
│           │  • Character Creation   │  ## Group vs Community           │
│           │  • Skills               │  body...                         │
│           │  • Combat               │                                  │
│           │  • Equipment            │  ## Recruitment Check            │
│           │  ▼ COMMUNITIES (active) │  body...                         │
│           │    ▸ Group vs Comm.     │                                  │
│           │    ▸ Recruitment        │  ## Apprentices                  │
│           │    ▸ Apprentices        │  body...                         │
│           │    ▸ Morale             │                                  │
│           │    ▸ Structure          │  ...                             │
│           │    ▸ CRB Additions      │                                  │
│           │  • Appendices…          │                                  │
└───────────┴─────────────────────────┴──────────────────────────────────┘
```

- Active section's anchors expand inline; inactive sections show only the section title.
- Auto-highlight current anchor as user scrolls (IntersectionObserver).
- Sticky positioning keeps the rules nav visible during long pages.
- Mobile/narrow: rules nav collapses into a top "On this page" `<details>` block.

---

## 5. Typography (matches existing Tapestry conventions)

- Bg `#0f0f0f`, body text `#f5f2ee` / `#d4cfc9`.
- Eyebrow: Carlito 13px uppercase letter-spaced `.2em`, color `#c0392b` (red accent).
- H1: Carlito 48px bold uppercase letter-spaced `.04em`, color `#f5f2ee`.
- H2: Carlito 28px bold uppercase letter-spaced `.06em`, color `#f5f2ee`, top-margin `3rem`, anchor target.
- H3: Carlito 18px bold uppercase letter-spaced `.08em`, color `#cce0f5`, top-margin `1.5rem`.
- Body: Barlow 17px `line-height: 1.8`, color `#f5f2ee`.
- Tables: 13px Barlow, header row Carlito uppercase, border `#2e2e2e`, accent border-left `#c0392b` on emphasized rows (Wild Success / Moment of High Insight).
- Cross-link callouts: small card, `border-left: 3px solid #7ab3d4`, "Try it →" link in `#7ab3d4`.

No new color tokens. No new fonts. Min inline fontSize stays at 13px.

---

## 6. Source format

- **Eventual**: MDX files in `content/srd/*.mdx` (one per section), imported by route pages. Live cross-link components (`<TryIt href="/communities">…</TryIt>`) embedded inline.
- **Test page (this PR)**: TSX with content as a React tree, structured to match the future MDX 1:1 (one `<RuleSection id="…" title="…">…</RuleSection>` per anchor). Keeps deploy risk zero (no new deps), and the TSX→MDX migration is mechanical when we're ready.

---

## 7. Public-route gating

`components/LayoutShell.tsx` `PUBLIC_PAGES` currently does strict equality on pathname. Need to add prefix matching for `/rules` so all subpages are guest-accessible. Same change unblocks `/rules` showing in the sidebar for ghosts.

---

## 8. Wix export — Strategy B

`scripts/build-rules-html.mjs`:
1. Spawns Next in production-build-once mode (or imports the section data directly — simpler).
2. For each `/rules/*` route, renders the page body to standalone HTML.
3. Inlines a small CSS block with the typography rules above.
4. Absolutizes all `/communities`, `/characters` etc. links to `https://thetapestry.distemperverse.com/...`.
5. Writes one `.html` file per route to `out/wix-rules/`.
6. User opens each file, copies the body, pastes into a Wix HTML-embed block on the matching Wix page.

Re-run after each rules update.

---

## 9. What's out of scope for v1

- Search across rules (defer to ⌘-F).
- Per-user highlights/notes (would need DB).
- Print stylesheet (Wix HTML-embeds break print anyway).
- Live MDX hot-reload during play sessions (rules don't change during a session).
- Translating Wix updates back into Tapestry (one-way: Tapestry MDX → Wix HTML).
