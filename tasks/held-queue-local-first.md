# The held queue - how work waits, and how it eventually lands (local-first, from 2026-09-16)

Under the local-first policy (`tasks/decisions.md` 2026-09-16), finished work is not pushed. It waits on branches and is composed into the primary checkout for Xero to evaluate on his dev server. This file is the ledger of what is held and the rules for how it lands, so conflicts are resolved as they arise rather than discovered at merge time. **The hub maintains it.**

## What is held right now (2026-09-16)

| Item | Commit | Branch | On localhost? | Notes |
|---|---|---|---|---|
| Route tool: speed slider + Travel blip | `25c16983` | `hp/localhost-stack` | yes | |
| Campaign Sheet: Eat / Rest / Relax wired | `c7a2f7db` | `hp/localhost-stack` | yes | Touches `app/campaign-sheet/page.tsx` |
| Visual dice roller (Q4) | `fb3a805b` | `hp/localhost-stack`, `hp/dice-roller` | yes | |
| Player NPC folder drag-drop (Q9) | `cd199dd8` (orig `00c0cc0f`) | `hp/localhost-stack`, `hp/player-bugs` | yes | Hub-approved |
| Fog of war / shared scene (Q3) | `b626ad26` | `hp/player-bugs` | NO | Hub-approved. BLOCKED: needs `campaigns.shared_scene_id` in the one live database before it runs even on localhost |

Already live, shipped before the policy change: GM NPC-card First Impressions (Q2, `4b0274bb`).

Coming, not yet built: `persistNpcSort` error handling (table page, hub review), Q6 part 2 Campaign Sheet NPC cards (collides with Eat / Rest / Relax in the same file), Q8 hand-raise.

## Branch rules

1. **Every feature keeps its own branch cut from `origin/main`.** Not from the composition. This is the important one: Xero evaluates and approves feature by feature, so each item has to stay independently shippable. A single linear stack would force "all or nothing", which fights the policy.
2. **`hp/localhost-stack` is a DISPOSABLE composition,** never the source of truth. It exists so Xero has one tree with everything in it. Rebase it onto `main` whenever docs land. If it is ever lost, it is rebuilt from the feature branches.
3. **Nothing lives only in a working tree.** Every held commit must be reachable from a named branch. (Learned 2026-09-16: the route tool and Eat / Rest / Relax briefly existed only in the primary checkout, where a stray reset would have destroyed them.)
4. **Two features touching the same file get SEQUENCED, not parallelised.** Build the second on top of the first's branch and treat them as a pair that ships together. Eat / Rest / Relax and Q6 part 2 both edit `app/campaign-sheet/page.tsx`, so Q6 part 2 branches off the Eat / Rest / Relax branch. Xero is unlikely to want one without the other in the same file, and it avoids re-resolving the same conflict on every recomposition.
5. **Gates run on the COMPOSED tree, not just per branch.** The composition is what Xero actually tests, and per-branch gates do not prove the combination works. Same reasoning as the merge-commit lesson: a clean commit says nothing about the tree it lands in.

## How an item lands when Xero approves it

1. He names the item(s) he wants live.
2. The hub cherry-picks that feature's branch onto current `main` in an isolated worktree.
3. The hub runs the full gate suite by hand on that exact tree (cherry-picks do not fire the pre-commit hook reliably), plus the pre-ship five questions.
4. Any live SQL that item needs is applied first, on his explicit, named go, and verified.
5. Push. Then HP rebases `hp/localhost-stack` onto the new `main` and recomposes what is still held.

Docs-only commits keep going to `main` throughout: they are how the lanes coordinate and they change nothing a user sees.

## Standing rule: verify the dev server before sending Xero to it

Localhost is now the only path to shipping, so its liveness is load-bearing. Before telling Xero (or Comms) that something is ready to test:

- Confirm the server is actually answering, not merely that a process exists or a port is bound. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` and expect 200.
- **Allow for a cold compile.** A Next dev server on this app can bind the port and still not answer for a while on first request. An 8-second timeout returned HTTP 000 on 2026-09-16 and read as "dead" when the server was simply starting; a patient request got 200 in about a second. Do not declare it down off one short timeout.
- Confirm it is THIS project on the port. Check the owning process, since another project has squatted port 3000 on this machine before: `netstat -ano | grep ":3000.*LISTENING"`, then the command line of that PID.

**Why this is a process rule rather than an automated monitor:** a dead dev server is non-destructive and immediately visible to the person affected, and the guard sits exactly where the risk is (the moment before he is sent to test). That is different from the E2E cleanup sweep, which was made safe in code because its failure was silent, destructive, and hit someone other than the person who caused it. Folding a localhost liveness line into the existing 3-hourly health-pulse is worth doing as a backstop when that routine's definition is next reachable; a 3-hour window would not have caught this anyway.
