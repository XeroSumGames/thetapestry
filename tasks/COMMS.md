# COMMS.md - open questions, test plans, decisions in flight

Single source of truth for "what's open, what's answered" across the three
lanes. Route decisions through this file instead of asking Xero (or each
other) in scattered chat messages that the other two lanes never see. The
hub (`tasks/HUB-LIVE.md`) is responsible for keeping this current and
resolving OPEN items into ANSWERED, but any lane can add an OPEN item -
don't wait for the hub to notice something needs asking.

**This is not a duplicate of `tasks/active-lanes.md`** (that's "who's
touching what file right now") or `tasks/decisions.md` (that's the
append-only architectural-decision log, permanent record). This file is
for things actively waiting on an answer - a question for Xero, a test
plan that needs running before a fix can be called done, a cross-lane
call that needs the hub's ruling. Once resolved, the item moves to
ANSWERED here; if it was ALSO an architectural decision worth permanently
remembering, it gets its own entry in `decisions.md` too.

---

## OPEN

*(none right now)*

---

## ANSWERED

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*
