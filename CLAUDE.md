@AGENTS.md

## Workflow Orchestration
### Helping me:
    – Never make assumptions about my ability or confidence level.
    – Don't skip steps & be explicit. 
    – Give full commands like "notepad app\campaigns\page.tsx" instead of just "app\campaigns\page.tsx"
    – Give me a testing plan each time to confirm the changes work. 
    – Write the testplan to C:\TheTapestry\tasks\testplan.md
    – You are keeping a running TODO list, item for the learn.md file, and a roadmap. I will ask you periodically to export them so I can add them to the project

### 1. Plan Node Default
    – Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
    – If something goes sideways, STOP and re-plan immediately – don't keep pushing
    – Use plan mode for verification steps, not just building
    – Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
    – Use subagents liberally to keep main context window clean
    – Offload research, exploration, and parallel analysis to subagents
    – For complex problems, throw more compute at it via subagents
    – One task per subagent for focused execution

### 3. Self-Improvement Loop
    – After ANY correction from the user: update tasks/lessons.md with the pattern
    – Write rules for yourself that prevent the same mistake
    – Ruthlessly iterate on these lessons until mistake rate drops
    – Review lessons at session start for relevant project

### 4. Verification Before Done
    – Never mark a task complete without proving it works
    – Diff behavior between main and your changes when relevant
    – Ask yourself: "Would a staff engineer approve this?"
    – Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
    – For non-trivial changes: pause and ask "is there a more elegant way?"
    – If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
    – Skip this for simple, obvious fixes – don't over-engineer
    – Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
    – When given a bug report: just fix it. Don't ask for hand-holding
    – Point at logs, errors, failing tests – then resolve them
    – Zero context switching required from the user
    – Go fix failing CI tests without being told how

### Task Management
    1. **Plan First**: Write plan to tasks/todo.md with checkable items
    2. **Verify Plan**: Check in before starting implementation
    3. **Track Progress**: Mark items complete as you go
    4. **Explain Changes**: High-level summary at each step
    5. **Document Results**: Add review section to tasks/todo.md
    6. **Capture Lessons**: Update tasks/lessons.md after corrections

### Core Principles
    – **Simplicity First**: Make every change as simple as possible. Impact minimal code.
    – **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
    – **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Rulebook references

The authoritative rules for the XSE / Distemper system live as PDFs in `docs/Rules/`. Read them via `pdftotext` (available on the shell) rather than the PDF Read tool — it's faster and doesn't require pdftoppm.

**Precedence when rules conflict** (higher wins):

1. `XSE SRD v1.1.17 (Small).pdf` — **canonical**, most recent. Core mechanics live here (§08 Communities, etc.).
2. `Distemper CRB v0.9.2.pdf` — Distemper Core Rulebook. Adds setting-flavor rules + Paradigms + Inspiration Lv4 etc. Pre-dates SRD 1.1, so defer to SRD on anything they both cover.
3. `Distemper Quickstart v0.8.530.pdf` — slim intro, narrative-first. Rule references here are derivative.
4. `Distemper Chased (Magazine) v0.8.116.pdf` — setting content for Chased (Delaware). Not a rules source; defer to the rulebooks for mechanics.
5. `The District Zero Sourcebook v0.9.04.pdf` — setting content for District Zero. Narrative + NPCs + pins. Defer to rulebooks for mechanics.
6. `The District Zero Road to Citizenship Sourcebook v0.1.01.pdf` — supplementary District Zero content.

**Pre-digested extracts** (when written) live in `tasks/rules-extract-*.md` — consult those first for a given subsystem before re-reading the PDFs, and audit them against the source when something feels off.

Existing spec files (`tasks/spec-communities.md`, `tasks/spec-modules.md`) are implementation specs written from these rules. If the spec and the rules disagree, the rules are canonical — update the spec, don't code the wrong thing.

