# Workflow Guide — using the puffer-fish system

This is the practical "how do I actually use what we built" companion to [operating-mode.md](operating-mode.md) (which describes what the system IS). Pull this up when you want a refresher.

---

## The artifacts at a glance

| File | What it's for | When you open it |
|---|---|---|
| `CLAUDE.md` + `AGENTS.md` | Project conventions (UI, code, canon) | Rarely — Claude auto-loads them |
| `tasks/handoff.md` | Operational ("resume the work") | Start of a session, paste from clipboard |
| `tasks/debug-handoff.md` | Diagnostic ("where do I look?") | When something breaks, or before a risky ship |
| `tasks/operating-mode.md` | Relational ("how Claude thinks alongside you") | Rarely — Claude auto-loads it |
| `tasks/slash-conventions.md` | Quick reference for slash commands | When you forget which slash fits |
| `tasks/workflow-guide.md` (this file) | How to USE the system day to day | Now and again to refresh habits |
| `tasks/health-pulse.md` | Auto-maintained short-term drift log | When you see a new `health-pulse:` commit |
| `tasks/security-audit.md` | Auto-maintained weekly security log | When you see a new `security-audit:` commit |

---

## Daily flow

1. **Claude already knows the system.** `CLAUDE.md` auto-loads `AGENTS.md` and `operating-mode.md`. Claude has context on the 8 standing roles, slash conventions, bright lines, the test infrastructure, and the periodic routines. You don't have to brief Claude on any of this.

2. **State the task plainly.** Default mode = all-perspectives weighted. Claude will pick the load-bearing role perspectives and surface tradeoffs without being asked.

3. **When you want focused single-role output, use a slash.** The seven:
   - `/architect` — system design, scaling
   - `/security` — threats, auth, PII, payments
   - `/qa` — bug-class analysis, test design
   - `/product` — prioritization, scope
   - `/ops` — reliability, incidents
   - `/business` — pricing, retention
   - `/ux` — appealing? functional? intuitive?

   Full reference with example triggers: [slash-conventions.md](slash-conventions.md).

4. **Before non-trivial ships, Claude runs the pre-ship 5-question check** and reports answers BEFORE committing:
   - If this breaks at the table mid-session, what do players see?
   - How would we know it broke without a player telling us?
   - Symptom patch or root-cause fix?
   - Nth time touching this area in 30 days?
   - What does undo look like, and how fast?

   Listen for these. Push back if any answer is weak. Don't accept "you'll see it when it breaks."

5. **Push back. Always.** When Claude proposes a change, ask *"what's the cost from a perspective I didn't think about?"* — this triggers cross-role thinking even without a slash. Over time you'll internalize the questions.

---

## When something breaks

1. Open `tasks/debug-handoff.md`.
2. Triage via Sec. 4 (Triage Playbook). Six steps, including the **15-minute rule**: if the fix isn't obvious in 15 minutes and a recent change is implicated, **revert first**. A reverted bug is a non-bug; a bug under investigation is still hurting live users.
3. Fix.
4. Add a unit test if the broken behavior is testable. (Already a memory-noted habit.)
5. Update the Risk Register if a load-bearing part's health changed color.

---

## When the autonomous routines flag something

You'll see commits on main with these subject prefixes:

- **`health-pulse: <summary>`** — the 3-hour routine flagged something (broken gate, new vuln, drift). Open `tasks/health-pulse.md`, read the newest entry at the top, take the action, leave the entry as historical record.

- **`security-audit: <summary>`** — the weekly Tuesday 10:23 MDT deep-scan routine flagged something. Open `tasks/security-audit.md`. Most findings are advisory not urgent. Check the "Top 3 priorities" line at the bottom of each entry.

**Trust silence.** No new `health-pulse:` commit = healthy. No new `security-audit:` commit = clean. Don't go looking.

---

## Periodic deeper reviews (you invoke)

These are not on a cron. You invoke them when you want.

- **`/architecture-review`** (weekly suggested, Sunday evenings work well) — what tech debt accumulated, what scale concerns surfaced, smallest move to lower future risk.
- **`/commercial-review`** (monthly suggested, 1st of the month) — payment readiness, GDPR posture, uptime metrics, blocking items between us and paid signups.
- **`/pre-launch-audit`** (one-time, when you're ready to open paid signups) — top-down review across all 8 roles. Outputs a punch list. Multi-hour Claude session.

---

## Multi-chat workflow

You'll have multiple Claude chats open at once — one for tactical shipping, this one for infrastructure/strategic, sometimes a "organize my thoughts" chat. Here's how they coexist:

- **All chats see the same artifacts.** Operating-mode, debug-handoff, handoff, slash-conventions all live in the repo. Any Claude session pulls them automatically.
- **The artifacts ARE the coordination.** Two Claudes can work on different surfaces without stepping on each other because the conventions both should follow are encoded in the docs.
- **Test suite + CI + pre-commit hook = enforcement.** Both chats are gated by the same pre-commit hook + GitHub Actions workflow. A bad ship from either gets caught.
- **Memory notes propagate via Claude's per-account memory** (your `~/.claude/projects/C--TheTapestry/memory/`). Future sessions in any chat load these.
- **When a chat needs to handoff to another:** mention the commit hash in the commit message ("see also commit XYZ from the other thread") so the next session can git log and find the context.

---

## Habits worth building

- **The five questions.** When Claude proposes a change, you ask the pre-ship 5. Eventually Claude offers them unprompted. Until then, drop them in yourself.

- **Add a test per bug fixed.** Already a habit. After the fix lands, the same response should add a test to `tests/lib/*` that would have caught it. Over months the suite covers real failure modes, not hypothetical ones.

- **Trust silence from the routines.** Absence of new commits = healthy.

- **Don't override bright lines.** When Claude says "I need to confirm before X" — that's the system working. Don't say "just do it" unless you've actually thought about it.

- **Run the slash periodic reviews on a cadence.** Sunday `/architecture-review`, 1st-of-month `/commercial-review`. Even when there's nothing dramatic to report, the discipline matters.

- **Update debug-handoff.md when health changes.** When a yellow item goes green (clean playtest, no regression), move it. When a green item degrades, move it. The Risk Register is only useful if it's current.

---

## What to ignore (or address later)

- **Don't ask Claude to list all 8 perspectives on every response.** They're there in the background; only the load-bearing ones surface. Asking for all of them every time is noise.
- **Slash conventions you never use will fade naturally.** Don't force `/business` if you don't have business questions yet. They'll get used when they're needed.
- **The pre-launch audit is one-time.** Don't run it monthly. It's for the moment before you open paid signups.
- **The decisions.md ledger is lazy-created.** No need to seed it; the first time we make an architectural call that's worth remembering, Claude creates it.

---

## When to update the system itself

**Update `tasks/operating-mode.md` when:**
- A standing behavior adds friction without value (drop it).
- A new role earns its place (data engineer? designer-in-residence?).
- Trajectory shifts (co-founder, 1000 paying users, acquisition offer).
- A bright-line rule keeps getting hit unnecessarily (it's probably the wrong rule).

**Update `tasks/debug-handoff.md` when:**
- A load-bearing part's health changes color.
- A tech debt item gets paid down OR a new shortcut earns an entry.
- A new failure mode reveals a gap in the Risk Register.

**Update `tasks/slash-conventions.md` when:**
- A new slash earns a slot.
- An example trigger turns out to be the wrong shape.

**Update this file (workflow-guide.md) when:**
- You discover a usage pattern that should be codified.
- A habit you thought would stick didn't, and we need to explain why.
- A workflow step keeps tripping you up.

---

## The honest reminder

This system makes Claude bigger than one engineer. It does NOT make Claude infallible, and it does NOT scale beyond your attention. At 50k users, the bottleneck won't be code — it'll be support, moderation, payment disputes, community. The puffer-fish buys you time and rigor, not a free pass. Plan for the moment when you need to spend money on the things the puffer-fish can't simulate (real lawyers, real security audits, real user research, real community management).
