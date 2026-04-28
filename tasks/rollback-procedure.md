# Rollback procedure — perf extraction work

Setup committed 2026-04-27 evening. Use this if anything breaks during the
local-only perf work and you need to get back to the known-good main state.

## What the safety net is

| Ref | What | Where |
|---|---|---|
| `safepoint/perf-extraction-base` | Git tag at known-good main HEAD (commit `6625a07`). All shipped perf work + modules Phase C are in here. | origin (pushed) |
| `claude/charming-lalande-db91fd` | The branch the agent's worktree commits to. | origin + local worktree |
| `perf/local-test` | The branch your `C:\TheTapestry` checkout follows. Mirrors the worktree branch — gets pushed every time a new perf commit lands. | origin + your local main checkout |
| `main` | UNTOUCHED during this work. No pushes. Vercel keeps deploying whatever was last on main. | origin |

## What's actually live

- **`https://thetapestry.distemperverse.com`** is on `main` — last deploy is commit `6625a07`. Nothing the agent does on `perf/local-test` reaches the live site.
- **Your local `C:\TheTapestry` is on `perf/local-test`.** When you run `npm run dev`, you're testing the work-in-progress code.

## Running it locally

From `C:\TheTapestry` in a terminal:

```
npm run dev
```

Open `http://localhost:3000` in a browser. Sign in normally — same Supabase, same data.

After the agent makes a new commit and pushes:

```
git -C C:/TheTapestry pull
```

(no `--rebase` needed — perf/local-test is fast-forward only from the worktree).

## Rolling back

### "I don't like this last change, undo it"

The agent does this for you — say "roll back the last commit" and the agent will revert.

### "Something is fundamentally broken, get me back to main"

```
git -C C:/TheTapestry checkout main
```

Your local checkout is now back on main, identical to live. Live was never touched.

### "Nuke the entire perf branch and start over"

```
git -C C:/TheTapestry checkout main
git push origin --delete perf/local-test
git tag -d safepoint/perf-extraction-base
git push origin --delete safepoint/perf-extraction-base
```

(Tell the agent to do this if you want it gone — they can run all four.)

## Promoting the work to live

When you're confident the perf work is solid:

```
git -C C:/TheTapestry checkout main
git -C C:/TheTapestry merge --ff-only perf/local-test
git -C C:/TheTapestry push origin main
```

That fast-forwards main to the perf branch and triggers a Vercel deploy. The agent will do this for you when you say "ship it."

## Tagging intermediate "known good" points

As the agent makes commits, they'll tag particularly stable mid-points like:
- `safepoint/chat-extracted` — after chat panel extraction works
- `safepoint/rolls-extracted` — after rolls feed extraction works
- etc.

To roll back to one of those mid-points (rare but available):

```
git -C C:/TheTapestry checkout perf/local-test
git -C C:/TheTapestry reset --hard safepoint/chat-extracted
git -C C:/TheTapestry push --force-with-lease origin perf/local-test
```

The agent will do this for you on request.

## What can NOT go wrong

- Live can't break — no main pushes.
- The work is in two places (worktree branch + perf/local-test branch on origin) so even local disk failure can't lose it.
- The starting point (`safepoint/perf-extraction-base`) is tagged on origin — even if every branch were deleted, that tag survives.
