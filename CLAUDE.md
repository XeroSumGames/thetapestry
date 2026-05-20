@AGENTS.md
@tasks/operating-mode.md

## Workflow Orchestration
### Helping me:
    - Never make assumptions about my ability or confidence level.
    - Don't skip steps & be explicit. 
    - Give full commands like "notepad app\campaigns\page.tsx" instead of just "app\campaigns\page.tsx"
    - Give me a testing plan each time to confirm the changes work. 
    - Write the testplan to C:\TheTapestry\tasks\<topic>testplan.md (descriptive name, NOT generic testplan.md - e.g. loadtimestestplan.md, preplaytestsmoke-YYYY-MM-DD.md). This keeps multiple in-flight test plans from stomping each other.
    - You are keeping a running TODO list, item for the learn.md file, and a roadmap. I will ask you periodically to export them so I can add them to the project

### 1. Plan Node Default
    - Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
    - If something goes sideways, STOP and re-plan immediately - don't keep pushing
    - Use plan mode for verification steps, not just building
    - Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
    - Use subagents liberally to keep main context window clean
    - Offload research, exploration, and parallel analysis to subagents
    - For complex problems, throw more compute at it via subagents
    - One task per subagent for focused execution

### 3. Self-Improvement Loop
    - After ANY correction from the user: update tasks/lessons.md with the pattern
    - Write rules for yourself that prevent the same mistake
    - Ruthlessly iterate on these lessons until mistake rate drops
    - Review lessons at session start for relevant project

### 4. Verification Before Done
    - Never mark a task complete without proving it works
    - Diff behavior between main and your changes when relevant
    - Ask yourself: "Would a staff engineer approve this?"
    - Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
    - For non-trivial changes: pause and ask "is there a more elegant way?"
    - If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
    - Skip this for simple, obvious fixes - don't over-engineer
    - Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
    - When given a bug report: just fix it. Don't ask for hand-holding
    - Point at logs, errors, failing tests - then resolve them
    - Zero context switching required from the user
    - Go fix failing CI tests without being told how

### Task Management
    1. **Plan First**: Write plan to tasks/todo.md with checkable items
    2. **Verify Plan**: Check in before starting implementation
    3. **Track Progress**: Mark items complete as you go
    4. **Explain Changes**: High-level summary at each step
    5. **Document Results**: Add review section to tasks/todo.md
    6. **Capture Lessons**: Update tasks/lessons.md after corrections

### Core Principles
    - **Simplicity First**: Make every change as simple as possible. Impact minimal code.
    - **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
    - **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Rulebook references

**Read [`tasks/rules-system-workflow.md`](tasks/rules-system-workflow.md) FIRST before touching any rules content.** It documents the precedence rule, the file layout, the audit pattern, the corrected-output convention, and what I'm after when I ask for an audit or rewrite.

**Precedence when rules conflict** (higher wins, locked 2026-05-09, re-confirmed 2026-05-13):

1. **Tapestry canon** - `lib/xse-schema.ts` (data) + `app/rules/*` pages (prose). The export at `tasks/tapestry-rules-canon.md` is the snapshot for offline audits - regenerate via `npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md` whenever the schema or rules pages change.
2. **Distemper Quickstart** (`Distemper Quickstart (Book) v1.0.2.pdf` and successors) - beginner-facing booklet. Pre-dates current canon; rule references here are derivative.
3. **XSE SRD** (`XSE SRD Export v1.1.17.pdf`) - generic engine reference. Pre-dates canon's most recent additions (Communities chapter expansions, Lv4 Skill Traits, Negotiations, etc.). Defer to canon on anything they both cover.
4. **Distemper Core Rulebook** (`Distemper CRB v0.9.2.pdf` / `Distemper Core Rules v0.9.3 (Claude Edit).docx`) - full Core Rulebook. Setting flavor + expanded mechanics. Lowest priority - anything that contradicts canon must be revised.

**IMPORTANT:** When asked a rules question, walk the precedence stack TOP-DOWN. Hit canon first, then Quickstart, then SRD, then CRB. Don't reach for the CRB unless the upper three are silent.

**Setting-content sources** (not rules sources; defer to canon for mechanics):
- `Distemper Chased (Magazine) v0.8.116.pdf` - setting content for Chased (Delaware).
- `The District Zero Sourcebook v0.9.04.pdf` - setting content for District Zero. Narrative + NPCs + pins.
- `The District Zero Road to Citizenship Sourcebook v0.1.01.pdf` - supplementary District Zero content.

**Note on the SRD PDF**: it has a font-encoding bug that breaks `pdftotext`. Use `python-docx` for docx files and PyMuPDF (`fitz`) for the SRD PDF specifically. PDF Read tool also fails (no `pdftoppm`); claude.ai chat reads it natively via vision if you need a quick scan.

**Pre-digested extracts** (when written) live in `tasks/rules-extract-*.md` - consult those first for a given subsystem before re-reading the PDFs, and audit them against the source when something feels off. The `tasks/tapestry-rules-canon.md` snapshot supersedes the older `rules-extract-*.md` files where they overlap.

Existing spec files (`tasks/spec-communities.md`, `tasks/spec-modules.md`) are implementation specs written from these rules. If the spec and the rules disagree, the rules are canonical - update the spec, don't code the wrong thing.

