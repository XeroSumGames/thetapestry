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

- **[2026-08-02, Puffer Fish] portrait-bank read-side confidentiality.** The `portrait-bank` storage bucket is `public: true` - Supabase serves every object via an unauthenticated CDN URL with no RLS evaluation for reads, so "private" character portraits (`private/<uid>/...`) are fully readable by anyone with/guessing the URL, regardless of any policy. Write-side hole already closed (`sql/fix-portrait-bank-private-upload-2026-08-01.sql`). Real fix needs Xero's call on approach: (a) flip the bucket private + rework every `getPublicUrl()` consumer to signed URLs (breaks image loading everywhere - public shared portraits AND private ones - until every consumer is updated), or (b) migrate private uploads to a genuinely separate private bucket (a live data migration for already-uploaded files). Either way touches real users' already-uploaded images and needs browser verification before shipping - not something to rush blind. **Needs: which approach, and when to schedule the focused session for it.**
- **[2026-08-02, Puffer Fish] Account self-deletion cascades into OTHER users' content, contradicting the app's own "anonymized rather than deleted" promise.** `app/account/page.tsx` copy says entangled content (forum posts etc.) gets anonymized on deletion; the FKs say otherwise - `forum_threads`/`war_stories`/`lfg_posts`/`whispers` are `author_user_id ON DELETE CASCADE`, and their reply tables cascade a second level off the PARENT (not the author), so self-deleting hard-deletes a popular thread's replies from every OTHER user who replied to it, with zero warning to them. `modules.author_user_id` is correctly `ON DELETE SET NULL` - that pattern was just never extended to the other 4 tables. **Needs: a product decision, not a schema patch** - build the anonymize behavior for real (nullable author_user_id + "Anonymous" UI fallback across 4 more content types, likely needs Hunt & Peck for the UI half once the schema side is decided), or update the account-deletion copy to match what actually happens. This is a promise made to users about their data - Xero's call.

---

## ANSWERED

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*
