# Slash Conventions — quick reference

Start a message with one of these tokens to get a focused single-role response from Claude. No cross-role noise. Drop the slash anytime you want the all-perspectives default.

Defined in [tasks/operating-mode.md](operating-mode.md) Sec. "Explicit role invocation."

---

## `/architect` — system design, scaling, future-proofing

**When to reach for it:** you're about to start a non-trivial feature, picking a stack, deciding between two approaches, or wondering if something will hold up at 10x users.

**Example triggers:**
- *"I want to add real-time voice chat between players during combat. What's the right way to wire that?"*
- *"Should the table page be decomposed before we scale? What would that even look like?"*
- *"Do I move to a queue (BullMQ, etc.) for the time-tick drainers, or keep them in-process?"*
- *"I'm thinking of moving from Supabase to self-hosted Postgres. What breaks?"*

**What you get:** tradeoffs between concrete options, scale implications (does this hold at 10x? 100x?), what we'd have to rebuild if we pick wrong, what to commit to vs what to defer.

---

## `/security` — threats, auth, PII, payments

**When to reach for it:** you're touching auth, payments, file uploads, user-supplied input, anything a bad actor could exploit, or anything that could leak/lose data.

**Example triggers:**
- *"Players can now upload images for character portraits. Walk through the threats."*
- *"I want to let GMs share a campaign via a public link. What's the threat model?"*
- *"We're storing the last 4 digits of a credit card in metadata so users can identify their card. Is that OK?"*
- *"What happens if a malicious player tries to hammer the roll endpoint to DoS the campaign?"*

**What you get:** threat enumeration (what could a bad actor try?), specific attack vectors with severity, the smallest mitigation that closes each, and an honest flag when something needs an actual security audit beyond Claude's heuristic review.

---

## `/qa` — bug-class analysis, test design

**When to reach for it:** a bug surfaced and you want me to analyze the CLASS of bug, not just patch this instance. Also good when you're about to ship something risky and want to know what tests should exist.

**Example triggers:**
- *"Healing on time-tick duplicated heals during a Skip Week. What tests would have caught this?"*
- *"A player reported initiative skipping their turn. What's the family of bugs this could be?"*
- *"I'm about to refactor the combat state machine. What's the test surface that needs to exist first?"*
- *"This bug only reproduces when two players act on the same round. What's the test shape for race conditions?"*

**What you get:** the bug-class analysis (one instance vs systemic), the specific test that would have caught it (and where to add it in `tests/lib/`), and a scan of other places in the codebase likely to have the same shape.

---

## `/product` — prioritization, scope, "do we even build this?"

**When to reach for it:** you have multiple competing things you could build, you're not sure if a feature is scope-creep or strategic, or you're trying to figure out what NOT to do.

**Example triggers:**
- *"Three feature ideas: voice notes, audio dice roller, AI war-story summarizer. Which one matters most for paying conversion?"*
- *"A user requested per-campaign custom CMod buttons. Build it or refer to the existing Other CMod input?"*
- *"I have 4 weekends free this month. What's the highest-leverage thing I could ship in that time?"*
- *"This feature would take 3 days. It would serve maybe 5% of users. Build it?"*

**What you get:** a prioritization argument based on user impact, roadmap fit, and opportunity cost. Won't make the decision for you, but will lay out the case both ways.

---

## `/ops` — reliability, observability, incident response

**When to reach for it:** thinking about what happens when things break in production, what you'd do at 3am during an outage, or what you'd tell users when something fails.

**Example triggers:**
- *"If Supabase goes down for 2 hours during a Friday-night session, what happens? How would I know?"*
- *"A player reports the app is slow. How do I diagnose without their browser console?"*
- *"What's our backup strategy? If I deleted production tomorrow by accident, what could we recover?"*
- *"We're about to deploy a database migration on a Friday afternoon. Talk me out of it."*

**What you get:** failure modes mapped to what users see, observability gaps (places we wouldn't know it broke without a user telling us), rollback strategies with concrete commands, and what to put in the comms when something does go wrong.

---

## `/business` — pricing, retention, commercial strategy

**When to reach for it:** pricing decisions, churn analysis, paid-conversion funnel, anything about how money flows through the product.

**Example triggers:**
- *"I'm torn between $7/month per user or $20/month per GM with unlimited players. What are the dynamics?"*
- *"A power user is asking for an annual plan with a discount. Should I offer one?"*
- *"How do I know what features paying users actually use vs free users?"*
- *"What's the difference between churn at 30 days vs 90 days vs 365 days, and which should I worry about first?"*

**What you get:** tradeoffs, second-order effects (what does this incentivize?), counter-examples from comparable products, and an honest "you decide" — Claude lays out the case, you make the commercial call.

---

## `/ux` — appealing? functional? intuitive?

**When to reach for it:** deciding if something is visually right, intuitive on first encounter, accessible, or whether the interaction supports what the user is trying to do.

**Example triggers:**
- *"The character creation wizard is 8 steps. Players drop off at step 4. Walk me through what's happening from a first-time-user view."*
- *"Is this color palette readable for color-blind users?"*
- *"The combat UI has 14 buttons. Is that too many? What would a player look at first?"*
- *"I want to add a tutorial popover but I hate intrusive tutorials. What's the right pattern?"*

**What you get:** heuristic critique against UX principles (clarity, progressive disclosure, error recovery, feedback loops, affordances), specific changes that would improve the screen, and an honest flag that this is heuristic critique — real UX validation needs real user testing, which we don't have set up yet.

---

## Pattern + tips

- **Start the message with the slash.** `/architect <question>`. Don't bury it mid-message.
- **One slash per message.** If you want two perspectives, ask twice or use default mode.
- **Default mode (no slash)** gets all-perspectives weighted to whatever you're asking about. Use slashes when you want focused, low-noise output.
- **You can ask for a critique of your own thinking:** `/architect critique this idea: <your idea>`.
- **Pair with the periodic reviews:** `/architecture-review`, `/commercial-review`, `/pre-launch-audit` (defined in [operating-mode.md](operating-mode.md) Sec. "Periodic reviews").

---

## What's NOT a slash convention

Things that are NOT slashes, even though they look similar:

- `/help`, `/clear`, `/config` etc. — those are Claude Code CLI commands, handled by the harness.
- `/loop`, `/schedule`, `/review`, `/init`, etc. — those are skills, handled by the skill system.

The slash conventions in this file are conversational tokens Claude watches for. They don't trigger any harness behavior; they shape Claude's response.
