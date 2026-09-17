# The held queue - how work waits, and how it eventually lands (local-first, from 2026-09-16)

Under the local-first policy (`tasks/decisions.md` 2026-09-16), finished work is not pushed. It waits on branches and is composed into the primary checkout for Xero to evaluate on his dev server. This file is the ledger of what is held and the rules for how it lands, so conflicts are resolved as they arise rather than discovered at merge time. **The hub maintains it.**

## What is held right now (2026-09-16)

| Item | Commit | Branch | On localhost? | Notes |
|---|---|---|---|---|
| Route tool: speed slider + Travel blip | `25c16983` | `hp/route-tool` (`a3ccd111`), `hp/localhost-stack` | yes | Had NO individual branch until 2026-09-16; see the trap note below |
| Campaign Sheet: Eat / Rest / Relax wired | `c7a2f7db` | `hp/campaign-sheet-actions` (`63711d1f`), `hp/localhost-stack` | yes | Touches `app/campaign-sheet/page.tsx`. Q6 part 2 branches off this one, per the sequencing rule |
| Visual dice roller (Q4) | `fb3a805b` | `hp/localhost-stack`, `hp/dice-roller` | yes | |
| Player NPC folder drag-drop (Q9) | `cd199dd8` (orig `00c0cc0f`) | `hp/localhost-stack`, `hp/player-bugs` | yes | Hub-approved |
| Fog of war / shared scene (Q3) | `b626ad26` | `hp/player-bugs` | NO | Hub-approved. BLOCKED: needs `campaigns.shared_scene_id` in the one live database before it runs even on localhost |
| Failed NPC-reorder save now reported (follow-up to Q9) | `4da79f40` | `hp/player-bugs`, `6be9c1d8` on `hp/localhost-stack` | yes | Hub-approved 2026-09-16, gates run on main + Q9 + this (950 tests). Fixes BOTH call sites: the player tab and `components/NpcRoster.tsx` `handleNpcDrop`, the GM roster reorder, which had the identical swallowed error and which my review did not flag |

Already live, shipped before the policy change: GM NPC-card First Impressions (Q2, `4b0274bb`).

Coming, not yet built: Q6 part 2 Campaign Sheet NPC cards (branches off `hp/campaign-sheet-actions`, per the sequencing rule), Q8 hand-raise.

## Branch rules

1. **Every feature keeps its own branch cut from `origin/main`.** Not from the composition. This is the important one: Xero evaluates and approves feature by feature, so each item has to stay independently shippable. A single linear stack would force "all or nothing", which fights the policy.
2. **`hp/localhost-stack` is a DISPOSABLE composition,** never the source of truth. It exists so Xero has one tree with everything in it. Rebase it onto `main` whenever docs land. If it is ever lost, it is rebuilt from the feature branches.
3. **A branch LABEL on a linear stack does not create independence.** Pointing a new branch at a commit in the middle of a composed stack drags everything beneath it along as parents. To make a held item genuinely shippable on its own it must be cherry-picked onto `origin/main` as its own branch. (Found 2026-09-16: the route tool and Eat / Rest / Relax existed only inside `hp/localhost-stack`, so "ship just the route tool" had nothing to ship, and the sequencing rule below could not be applied because the branch it referred to did not exist. The ledger table showed this and the hub missed it.)
4. **Nothing lives only in a working tree.** Every held commit must be reachable from a named branch. (Learned 2026-09-16: the route tool and Eat / Rest / Relax briefly existed only in the primary checkout, where a stray reset would have destroyed them.)
5. **Two features touching the same file get SEQUENCED, not parallelised.** Build the second on top of the first's branch and treat them as a pair that ships together. Eat / Rest / Relax and Q6 part 2 both edit `app/campaign-sheet/page.tsx`, so Q6 part 2 branches off `hp/campaign-sheet-actions`. Xero is unlikely to want one without the other in the same file, and it avoids re-resolving the same conflict on every recomposition.
6. **Gates run on the COMPOSED tree, not just per branch.** The composition is what Xero actually tests, and per-branch gates do not prove the combination works. Same reasoning as the merge-commit lesson: a clean commit says nothing about the tree it lands in. Worse than the rule implies: **a cherry-pick fires no pre-commit hook**, so a composed stack has never been gated by the act of composing it. First composed run, 2026-09-16: green, 971 tests across 56 files, tsc clean, arch OK.

## How an item lands when Xero approves it

1. He names the item(s) he wants live.
2. The hub cherry-picks that feature's branch onto current `main` in an isolated worktree.
3. The hub runs the full gate suite by hand on that exact tree (cherry-picks do not fire the pre-commit hook reliably), plus the pre-ship five questions.
4. Any live SQL that item needs is applied first, on his explicit, named go, and verified.
5. Push. Then HP rebases `hp/localhost-stack` onto the new `main` and recomposes what is still held.

Docs-only commits keep going to `main` throughout: they are how the lanes coordinate and they change nothing a user sees.

## Standing rule: verify the dev server before sending Xero to it

Localhost is now the only path to shipping, so its liveness is load-bearing. Before telling Xero (or Comms) that something is ready to test:

There are TWO different failure modes and they need opposite responses, so check in this order:

1. **Is anything bound to the port at all?** `netstat -ano | grep ":3000.*LISTENING"`. Nothing bound means the process is GONE, not slow - the dev server task exited (HP hit exactly this on 2026-09-16, a background task dead with exit code 4 and nothing on 3000). The response is RESTART it. Waiting achieves nothing.
2. **Is it the right project on that port?** Take the PID from step 1 and read its command line; expect `next` out of `D:\Coding\VTTs\TheTapestry`. Another project has squatted port 3000 on this machine before, which would have Xero testing the wrong app.
3. **Is it actually answering?** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` and expect 200. If it is bound but silent, it is probably COLD-COMPILING, and the response is to WAIT, not restart: an 8-second timeout returned HTTP 000 on 2026-09-16 while the server was merely starting, and a patient request got 200 in about a second. Do not declare it down off one short timeout.

Conflating the two is the trap: the hub's first draft of this rule described only the cold-compile case, which would have sent the next reader to wait patiently on a process that had already exited.

**Why this is a process rule rather than an automated monitor:** a dead dev server is non-destructive and immediately visible to the person affected, and the guard sits exactly where the risk is (the moment before he is sent to test). That is different from the E2E cleanup sweep, which was made safe in code because its failure was silent, destructive, and hit someone other than the person who caused it. Folding a localhost liveness line into the existing 3-hourly health-pulse is worth doing as a backstop when that routine's definition is next reachable; a 3-hour window would not have caught this anyway.
