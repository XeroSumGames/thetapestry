# Lessons Learned

## Database & Auth
- **Role is stored capitalized**: `profiles.role` is `'Thriver'` not `'thriver'`. Always use `.toLowerCase()` when comparing roles. NavBar does this — other pages didn't, causing silent redirects.
- **RLS blocks everything by default**: When creating new tables, always add RLS policies immediately. Storage buckets need separate policies on `storage.objects` — the bucket existing is not enough.
- **Supabase Storage buckets must be created manually**: They don't auto-create from code. Each bucket needs INSERT/SELECT/DELETE policies on `storage.objects` filtered by `bucket_id`.
- **Column must exist before code references it**: Always provide the ALTER TABLE SQL alongside the commit. Don't assume the user has run previous SQL.

## React & Next.js
- **Emoji icons don't respond to CSS `color`**: Emojis render as images. Use SVG icons if you need color to change dynamically (e.g., notification bell).
- **`await` your Supabase calls**: Fire-and-forget (`supabase.from(...).update(...)` without `await`) causes race conditions. The Realtime subscription can fire before the write completes, reading stale data.
- **Optimistic state updates prevent stale reads**: When updating a value (like insight dice), update the local state immediately in addition to the DB write. Don't rely solely on Realtime to propagate changes.
- **Layout flash on conditional rendering**: If a layout element (sidebar) depends on async state, the page will flash/jump when that state resolves. Fix by either always showing or always hiding the element on that route, not conditionally based on async data.
- **`return null` during loading causes layout shifts**: Use `return <div style={{ background: '#0f0f0f' }} />` instead to maintain the DOM structure.

## Styling
- **Header buttons must all be the same size**: The campaign table header bar uses the `hdrBtn()` helper for uniform 28px height, 11px Barlow Condensed buttons. When adding new buttons to this bar, ALWAYS use `hdrBtn()` — never inline custom styles. This has been broken and fixed before. Check `hdrBtn` usage before adding any button to the header.

- **`#5a5550` is too dim**: This color was used as secondary text throughout the app but is nearly invisible on dark backgrounds. Replaced globally with `#cce0f5` (light blue).
- **Minimum font size is 13px**: Never use font sizes below 13px anywhere in the UI. The dark background makes small text unreadable. Badges/tags: 13-14px. Body text: 14-15px. Headings scale up from there. Multiple rounds of +2px bumps were needed across roll feed, session history, and NPC roster because initial sizes were too small.
- **`appearance: 'none'` on selects**: Required for consistent cross-browser styling of dropdowns.
- **Grid needs enough container width**: `auto-fill` grids won't show multiple columns if the parent container is too narrow (e.g., constrained by sidebar). Use fixed column count (`repeat(5, 1fr)`) when you know the layout.

## Architecture
- **Extract large features into components**: The table page was getting huge. NpcRoster, NotificationBell, and VisitLogger were extracted as separate components to keep the main page manageable.
- **Store structured data, serialize for display**: Skills are stored as `{ entries: [...], text: "..." }` — structured for programmatic use, text for backwards compatibility and display.
- **`SECURITY DEFINER` on trigger functions**: Required for triggers that insert into tables with RLS (like notifications), since triggers run as the invoking user who may not have insert permissions.

## Process
- **Always provide SQL upfront**: When a feature requires a DB schema change, provide the ALTER TABLE / CREATE TABLE SQL immediately in the same message — don't wait for the user to ask. The user shouldn't have to chase for it. This is explicitly required in CLAUDE.md: "Always provide the ALTER TABLE SQL alongside the commit."

- **Provide all pending SQL in order**: When multiple features add columns/tables, the user may not have run earlier SQL. Always check and provide the full chain.
- **Debug logging is essential for remote debugging**: When the user can't see what's happening, add `console.log` with prefixed tags like `[EndSession]`, `[StatUpdate]`, then remove after diagnosis.
- **Test on the actual deployment**: localhost behavior can differ from deployed behavior (caching, env vars, auth state).
- **Verify the DB table/column exists before assuming code works**: A 400 error or silent null often means the schema doesn't match the code.
- **Supabase auth triggers must use EXCEPTION handler**: If a trigger on `auth.users` fails, Supabase rolls back the entire transaction including user creation, showing "Database error saving new user". Always wrap trigger INSERT in EXCEPTION WHEN OTHERS to prevent blocking signup. The client-side fallback code handles profile creation if the trigger fails.
- **CHECK constraints vs trigger values**: The `handle_new_user` trigger was inserting `'survivor'` (lowercase) but `profiles.role` has a CHECK constraint requiring `'Survivor'` (capitalized). Always match exact casing in trigger functions.
- **SECURITY DEFINER doesn't always bypass RLS in Supabase**: Despite documentation, trigger functions with SECURITY DEFINER may still be blocked by RLS policies. Add an EXCEPTION handler as a safety net.
