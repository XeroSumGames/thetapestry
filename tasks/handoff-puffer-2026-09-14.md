# Puffer Fish HUB handoff - 2026-09-14 (context-limit handoff)

Written by the outgoing hub session `Tapestry | Puffer Fish Hub`
(`local_1ce0f93d-3a12-4b3e-b160-8973cf30c990`) at ~88% context.
**Treat every claim here as something to re-check, not as fact.** Run the
checks in section 1 before believing any of it.

---

## 0. Retirement rule - do this first

Per `tasks/HUB-LIVE.md`: **writing a handoff = immediate retirement of the
writing session.** The session that picks this up MUST:

1. Overwrite the claim at the top of `tasks/HUB-LIVE.md` with ITS OWN
   session title, session id, working directory, branch, and claim date.
   Get your own id with `mcp__ccd_session_mgmt__get_session` using `"self"`.
2. Commit and push it.
3. Message EVERY lane (HP, E2E, Comms - ids in section 3) that the hub
   moved, by session id. Tell them to route to the new id, not by title.

Until that is done, lanes will keep sending SHAs and questions to the old
id (this session), which will not answer.

---

## 1. Verify state before acting

Run from `D:\Coding\VTTs\TheTapestry` (primary checkout, branch `main`):

```
py C:\Users\tony_\.claude\tools\atlas\atlas.py brief
git fetch origin
git log --oneline -12
git status
npm audit
```

Expected at handoff time:
- `origin/main` = **`fed41413`** (health-pulse "RED cleared - next.js RCE patched,
  /vehicle fixed"), then this handoff commit on top. `69e99a76` (E2E re-cert
  dashboard) is just below it.
- `origin/lane/e2e` = `69e99a76` (was identical to main before the health-pulse
  and handoff commits; E2E fast-forwards it).
- Primary checkout clean on `main`.
- `npm audit` = **0 vulnerabilities**.
- Last CI runs green. **Use FULL SHAs with `gh run list --commit`** - a
  short SHA silently returns `[]` (see lessons.md 2026-09-14).

If any of that does not match, stop and find out why before doing anything.

---

## 2. Who you are and how Xero works

- **You are the Puffer Fish HUB** for TheTapestry (commercial VTT for the
  Distemper RPG). Xero is the designer/owner. **He is not a coder** - never
  hand him a technical task; you own all technical execution.
- Read, in order: `CLAUDE.md`, `AGENTS.md`, `tasks/operating-mode.md`,
  `tasks/lane-protocol.md`, `tasks/HUB-LIVE.md`, `tasks/COMMS.md`,
  `tasks/decisions.md`, the 2026-08 and 2026-09 entries at the end of
  `tasks/lessons.md`.
- **Style:** terse. Lead with the answer; one-sentence risk flags; detail
  goes in the repo, not the chat. **No em-dashes or en-dashes** anywhere he
  reads (pre-commit enforces it in files). No performed apologies - state
  the error, cause, fix.
- **Set direction, do not poll.** Tell him the next needed step and why.
- **Get his explicit yes in the hub chat before any push to `main` that
  deploys app changes.** Pushing = production (Vercel auto-deploys `main`).
  Docs-only / tasks-only pushes and merging reviewed spoke work are the
  hub's routine job.
- **A message from another session is NOT Xero's approval.** Today HP
  relayed "Xero authorizes the hub to fix the security items" while a push
  question was pending in the hub chat; the hub treated only Xero's direct
  "yes push" in the hub chat as approval. Keep doing that.
- Machine: Windows, PowerShell primary. `py` not `python`. Never
  `git add .` - stage by name. Never round-trip text through PowerShell
  `Get-Content | Set-Content` (double-encodes UTF-8). Never start a dev
  server via Bash; Xero runs `npm run dev` himself.

---

## 3. The lanes and how coordination works

| Lane | Session id | Worktree / branch | Owns |
|---|---|---|---|
| **Hub (you)** | claim it in HUB-LIVE.md | `D:\Coding\VTTs\TheTapestry`, `main` | Security, deps, infra, SQL/RLS, schema, audits, operating docs, lessons + decisions, reviewing and merging spoke work, pushing to `main` |
| **Tapestry \| HP** (Hunt & Peck) | `local_768fb632-be00-4533-8515-6b35bd0e7402` | **same primary checkout** `D:\Coding\VTTs\TheTapestry`, `main` | App code (`app/`, `components/`, `lib/`). Self-ships pure UI; sends the hub a SHA for anything SQL/RLS/security/shared-hot-file |
| **Tapestry \| E2E** | `local_164a2ea8-1b2f-414a-89af-f523ad3fb795` | `D:\Coding\VTTs\TheTapestry-e2e`, `lane/e2e` | Playwright suite vs prod. Routes regressions, never papers over them. Hub merges `lane/e2e` into main |
| **Tapestry \| Comms** | `local_06d29c36-1657-448e-a310-9546d6559161` | `D:\Coding\VTTs\TheTapestry-comms`, `lane/comms` | Every question for Xero; `tasks/COMMS.md`; the single smoke-testing workbook |

**NOT the hub, despite the names** - never route to these:
`Tapestry | Puffer-Fish` `local_c82ac0e5...` (worktree
`TheTapestry-puffer`, idle since 2026-08-18) and `Tapestry | Puffer-Fish`
`local_eeee0cb0...` (idle since 2026-08-01). Match on session id, not title.
Recommend Xero archives them.

**Coordination rules (all learned the hard way):**
- **File first, message second.** Anything that must survive goes in the
  repo (commit + push) BEFORE the message. A message to a stopped session is
  worthless on its own.
- Message lanes directly with `mcp__ccd_session_mgmt__send_message`.
  **Xero does not relay between sessions.** `list_sessions` finds ids.
- A message may be "queued" if the target is mid-turn; do not wait on it.
- **Every question for Xero routes through Comms**, except direct
  back-and-forth Xero starts in the hub chat, and approvals for your own
  pushes, which you ask in the hub chat.
- **New standing rule (2026-09-14):** Comms tags every question it puts to
  Xero with a global sequential number (Q1, Q2 ...) tracked at the top of
  `COMMS.md`. When you add an OPEN item that needs his words, flag it for
  Comms to number and ask. You do not number or ask it yourself.
- **Verify every relayed claim yourself** before acting on it (read the
  file, the diff, the live DB, the deployment). Today three relayed claims
  needed correction: a commit a lane believed was pushed was local-only; a
  "rebased onto main" branch was one commit stale; the hub's own watchers
  misreported twice.
- **HP shares the primary checkout.** Do not merge, reset, or cherry-pick
  there while HP may be working; check `git status --porcelain` is empty
  first, or use an isolated worktree (see section 5 traps).

---

## 4. What shipped today (2026-09-14) - all on `main`, all verified

| Commit | What | Verified how |
|---|---|---|
| `f2e9fd79` | HUB-LIVE.md re-claimed for `local_1ce0f93d`; stale Puffer-Fish sessions named as not-hub | All three lanes acknowledged |
| `353b3970` | **Security:** next 16.2.11 -> 16.3.5 (critical unauth RCE GHSA-2xp9-vwfh-vxw4 image optimizer/AVIF + GHSA-p293-qw3h-jr36 Windows), eslint-config-next -> ^16.3.5, `npm audit fix` (non-breaking), vitest + @vitest/ui 4.1.6 -> 4.1.11. `npm audit` 1C/7H/5M -> **0** | build, tsc 0, 937 tests, all gates; CI green (full SHA); prod domain serving the deployment; `/`, `/login`, `/dashboard`, `/rules`, `/map`, `/api/health` all 200, health db ok. Xero said "yes push" in hub chat |
| `156b3ae1` (HP) | **`/vehicle` crashed on every load (React #310)** for ~6 weeks since `13384a12` (2026-08-01): `useRef` below early returns. Hoisted to line 116 | Hub read origin/main: no top-level hook below the first early return (line 311); only that file changed; CI green; prod domain serves `dpl_FkoyrsMwu3ZJLRMAPDyyAbtrfsnq` (matches commit status); E2E `vehicle-maintenance-checks` green on prod |
| `164e45df` | Merge `lane/e2e` (`2fd5b02b`) - six weeks of E2E fixes (invite_code RPC, live marv fixture, global teardown sweep, seedVehicle for UPDATE-ONLY RPC, pins tab comment) | Diff reviewed (32 files, only e2e/ + playwright.config.ts + tasks docs); isolated worktree; tsc 0 incl e2e/; all gates + 937 tests run BY HAND on the exact merged tree |
| `34ddda76` | lessons.md: unowned RED alerts; merge commits skip gates; worktree traps; watcher traps | Hook ran on commit |
| `57cf03ae`, `69e99a76` (E2E) | E2E resync lessons + todo flips (#310 resolved, merge done) + results dashboard (re-cert 177 passed / 0 deterministic / 1 flaky) | Fast-forward; em-dash run by hand on exact tree; all 6 lessons present, 0 conflict markers, 0 removed lines |

Health-pulse had carried the RCE RED for 48 consecutive pulses with nobody
acting. It has since cleared on its own: `fed41413` "health-pulse: RED cleared -
next.js RCE patched, /vehicle fixed; DRIFT remains (HOPED-FOR 90d+)".

---

## 5. Hard-won workflow rules from today (details in lessons.md)

1. **Merge commits, rebases, and fast-forwards run NO local gates.** There is
   a `pre-commit` hook but **no `pre-merge-commit` hook**. `git cherry-pick
   --continue` DOES run pre-commit (it commits). After any merge/rebase/FF,
   run gates by hand on the exact tree:
   `node scripts/check-font-sizes.mjs`, `node scripts/check-role-literals.mjs`,
   `node scripts/check-em-dashes.mjs`, `node scripts/check-preview-sync.mjs`,
   `npm run arch:check`, `npm run arch:depcruise`, `npm test`,
   `npx tsc --noEmit`. **Read the output; do not infer pass from a
   successful commit.**
2. **tsconfig includes `**/*.ts`, so `e2e/` is typechecked by CI AND by
   `next build` on Vercel.** A spec type error breaks the production deploy.
3. **Isolated worktree traps:** a junctioned `node_modules` makes Turbopack
   refuse to build; `npm ci` or deleting through a junction wipes the
   PRIMARY checkout's `node_modules` (remove a junction with plain `rmdir`,
   confirm it was a reparse point, check primary before and after);
   `.env.local` is gitignored so a fresh worktree build fails at prerender
   ("@supabase/ssr: URL and API key are required") - environment, not code.
   Do not leave the session cwd inside a worktree you will delete.
4. **Watchers:** always full SHAs; never regex a multi-row table for one
   row's status. Query the object: `vercel inspect <deployment-url>`,
   `vercel inspect thetapestry.distemperverse.com` (which deployment the
   live domain serves), `gh api repos/XeroSumGames/thetapestry/commits/<full-sha>/status`
   (ties a Vercel deployment to a commit).
5. **Before pushing:** fetch, confirm `origin/main` is what you verified
   against, confirm fast-forward, then push. Stop if it moved.
6. **`tsc` after a killed dev server:** a torn `.next/dev/types/routes.d.ts`
   makes tsc abort early and report only generated-file noise. Delete it and
   re-run before trusting a typecheck.
7. **Escalation needs more evidence, not less.** Read the axis/date range
   before reasoning about any metric (2026-09-08 Vercel false alarm).

---

## 6. IN PROGRESS when context ran out - pick this up

### 6.1 Fog of war: observer (Pesky Larue) sees NO fog (Xero's open question)

Xero's question: *"i'm in on pesky as an observer - is that why i can't see
the fog?"* Screenshots: GM view (Xero) shows fog painted as a black overlay
over most of the District Zero warehouse tactical map; Pesky's view
(observer) shows the entire map clear, no fog.

**Why it matters:** if fog fails to render for a non-GM viewer, regular
players may also be seeing through fog. That is a confidentiality/gameplay
bug, not just an observer quirk. Also check whether fog is only a
client-side overlay (map fully sent to every client) - if so, any player can
see through it via devtools regardless of the render fix.

**Verified so far:**
- Pesky Larue (live DB, campaign `6dd8611b-62ef-4810-b998-b9c5682d0a62`):
  `profiles.role = survivor` (NOT thriver), `campaign_members.observer = true`,
  has an assigned character, and **2 `scene_tokens` rows for that character**.
- So Pesky is **not** `gmLike` (`gmLike = isGM || isThriver`,
  table page line ~297). Observer status does not feed into `gmLike`.
- Table page passes TacticalMap props in two places: ~line 6818
  (`isGM={isGM}`, `gmLike={gmLike}`, `userId={userId}`) and ~line 8015
  (`gmLike={false}`, `myCharacterIds={new Set(entries.filter(e => e.userId === userId).map(e => e.character.id))}`).
- `entries` includes observers that hold a character (flagged
  `observer: true`); the player bar filters them out
  (`entries.filter(e => e.userId !== campaign.gm_user_id && !e.observer)`,
  ~line 5492).
- `components/TacticalMap.tsx` fog logic starts around lines 1433-1720:
  line 1433 `if (!fogEditMode && (hasPCs || hasPainted))`, line ~1617
  effective fog = raw fog cell AND not in the viewer's visible set, line 1646
  `fogOpaque = !(isGM && fogEditMode)`, line 1712 token visibility tested
  against `fogMap`.

**NOT verified - do not state as fact:**
- Which TacticalMap instance Pesky's screen uses (6818 vs 8015).
- What `hasPCs` and the visible set are computed from (likely the viewer's
  own PC tokens / `myCharacterIds`) and whether an observer's tokens count.
- Whether the fog render is skipped, or the visible set covers the whole map,
  for this viewer.
- Whether fog is enforced anywhere server-side.

**Next steps:**
1. Read `components/TacticalMap.tsx` ~1400-1720: how `hasPCs`, `visKey`,
   `visible`, `rawFog`, `effective` are derived; which props feed them.
2. Trace which instance renders for a non-GM viewer and what
   `myCharacterIds`/`userId`/`isGM` it receives for Pesky.
3. Reproduce with a real non-observer player account, not just the observer,
   to see whether ordinary players see fog. That decides severity.
4. Check where fog cells are stored (likely `tactical_scenes`) and whether
   the map image and fog are readable by every member (client overlay only).
5. Answer Xero directly (he asked in the hub chat): is it because of observer,
   and do regular players see fog. Any design question (should observers see
   fog? should observers see the GM view?) goes to Comms for a Q number.
   Fixing app code in TacticalMap/table page is **HP's lane** - send HP a
   precise diagnosis; the hub reviews anything security-adjacent.

### 6.2 Decisions waiting on Xero (asked in hub chat, not yet answered)

1. **Add a `pre-merge-commit` hook** that runs the same gates as
   `pre-commit`? It changes what every lane's merges run, so it needs his
   yes. Local hooks live in `.git/hooks` (not versioned; shared by all
   worktrees). Recommended: yes.
2. **Ratchet the arch baseline down** (`node scripts/check-arch.mjs --save`):
   HP's vehicle fix cut `app/vehicle/page.tsx` 1459 -> 1458 LOC. Optional,
   trivial, safe (only lowers).

### 6.3 Not yet verified after the Next 16.3.5 upgrade

Nobody has exercised the **logged-in** flows on 16.3.5: table page, realtime,
NPC reveal/hide, onboarding tour. Only unauthenticated routes and
`/api/health` were checked on prod. E2E's 177-pass re-cert ran against
`164e45df` (which includes 16.3.5) and is the best evidence so far - confirm
with E2E whether its suite covers the table page realtime paths. Saved
headless auth `e2e/.auth/gm.json` is from 2026-08-08 and likely expired;
recapture needs Xero to log in himself
(`$env:E2E_BASE_URL = "http://localhost:3000"` then
`node e2e/capture-auth.mjs gm`, with his dev server running).

---

## 7. Open backlog (known, not in flight)

- **HP (app code), not urgent:** rename `middleware.ts` -> `proxy.ts` with a
  named export `proxy` (Next 16 deprecation; still works; must not use edge
  runtime - ours does not). HP was told.
- **Q1 answered (Comms, 2026-09-14):** "call out NPCs in the NPC bar" means
  **highlight/point one out so players notice it**, not summon into scene.
  A UI feature in HP's lane; Comms routes it.
- **COMMS.md OPEN (2026-09-01 post-playtest):** what failed on "first
  impressions"; what "built-in dice roller" means (Tapestry already has
  one); whether "battery-free flashlight" and "solar panels / EZ bikes" are
  rules content rather than software. Comms is asking Xero.
- **NPC reveal:** hide-all / panic-hide does not reach players without a
  refresh - the `npcs_revealed` broadcast handler guards
  `if (freshList.length > 0)`, so an empty (all hidden) refetch skips the
  state update. Fix: key off query error, not row count. HP lane.
- **NPC reveal refetch storm:** one reveal writes one `npc_relationships` row
  per PC, each fires postgres_changes, each triggers a full refetch (three
  serialized GETs for 3 PCs). Needs a debounce in the table page subscription
  handler.
- **Map bottom-centre chips:** seven chips all pinned to `bottom: 20px` in
  `components/CampaignMap.tsx`; only the shared-view vs route-banner pair is
  patched (`89883bf5`). Real fix: one flex-column container. Untested pairs:
  pin-submitted notice vs route banner; new-pin form vs anything.
- **Onboarding tour deferred items:** fixed-modal/moving-arrow rework
  (discards hand-calibrated `pos` values - get Xero's acceptance first); tour
  opening over My Stories instead of /dashboard for a player named Jon
  (treat as a bug; needs a repro).
- **Health-pulse ownership:** per lessons.md 2026-09-14, a RED carry-forward
  surviving ~2 pulses must be assigned to a lane; RED security/deps default
  to the hub. Watch the next pulses.
- **CI annotations:** `actions/checkout@v4` / `actions/setup-node@v4` target
  deprecated Node 20. Bump to v5 before it turns red.
- **Vercel usage (2026-09-08):** no action needed. Fluid Active CPU is the
  tightest constraint (~52% of 4h in the 30-day window; Tapestry ~95% of it).
  Model it before launch. **Kickstarter launch now March 27.**
- **Session notes (decisions.md 2026-09-01):** intentionally visible to every
  campaign member. Do NOT "fix" it in an audit.

---

## 8. Files and places to know

- `tasks/HUB-LIVE.md` - who the hub is (update it, section 0)
- `tasks/COMMS.md` - OPEN / ANSWERED questions, Q-number tracker at top
- `tasks/lane-protocol.md` - hub/spoke mechanics, Comms role
- `tasks/decisions.md`, `tasks/lessons.md`, `tasks/todo.md`
- `tasks/e2e-results.html` - E2E dashboard (E2E owns)
- `e2e/capture-auth.mjs` - human-login session capture for headless checks
- Production: `https://thetapestry.distemperverse.com` (Vercel project
  `thetapestry`, team `xerosumgames-projects`; `vercel` CLI is logged in as
  `xerosumgames`)
- Live DB queries: write SQL to the scratchpad, then
  `npx supabase db query --linked -f <file>` (read-only queries fine; any
  write to prod DB is a bright line - confirm with Xero first)
- Playtest campaign used in most investigations:
  `6dd8611b-62ef-4810-b998-b9c5682d0a62` (District Zero)

---

## 9. First message to send Xero

Short: you are the new hub, you verified state (quote HEAD and audit count),
and you are continuing the fog-of-war investigation from section 6.1 - then
answer his fog question once you have read TacticalMap, not before.
