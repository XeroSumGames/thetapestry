# Testplan — /moderate email visibility + visit-email gate fix

**Shipped 2026-05-08.**

Three fixes:
1. **Email-not-showing on /moderate** was a CSS overflow bug — only one profile (GrumpyBattersby) actually had `email = NULL`. The rest had emails but the row layout ellipsized them out of view behind long usernames.
2. **GrumpyBattersby's missing email** backfilled from auth.users. All 16 profiles now have `email`.
3. **Visit emails** were silently suppressed because every recent visitor was a returning user with `visitNumber > 5` (signed-in repeat-survivor suppression). Edge function `log-visit` now fires ONLY when `visitNumber === 1` — first visit ever from this `ip_hash`. Per-session "isFirstVisit" gate dropped (it was firing on every new browser session for ghosts).

---

## 1. Email visibility on /moderate

1. Sign in as a Thriver, go to `/moderate?section=users`.
2. Find the `wEpAfxklFqFikMBdndLxo` row. Their email `f.az.ekoza.4.41@gmail.com` should now be visible — on a second muted line below the username + role chip.
3. Find the `GrumpyBattersby` row. `grumpybattersby@gmail.com` should be visible too (was null in DB; backfilled tonight).
4. Confirm: every row has its email visible. None hidden behind ellipsis.
5. Confirm Joined date and Last login date sit on the same muted line as the email.
6. Confirm role chip (Survivor/Thriver) and any Suspended chip stay on the username line above.

## 2. Backfill verification

Run in SQL editor:
```sql
SELECT count(*) total, count(email) with_email, count(*) - count(email) missing
FROM public.profiles;
```
Should report `total = with_email`, `missing = 0`. (As of tonight: 16 / 16 / 0.)

## 3. Visit-email gate (live test)

Hardest to test from your own machine because owner emails are exempted from logging entirely (see `lib/events.ts` OWNER_EMAILS).

Three ways to verify:

**A. Incognito browser (recommended).**
1. Open a private/incognito window, navigate to `https://thetapestry.distemperverse.com/`.
2. Within ~30s, you should receive a `[The Tapestry] New Visitor — <city>, <country>` email at `xerosumstudio@gmail.com`.
3. Reload the page (still in incognito). You should receive **NO** second email.
4. Close incognito, re-open, visit again. Still no email — same `ip_hash`.

**B. Phone hotspot / different network.**
1. Switch laptop to phone hotspot. Visit the site fresh (ghost or signed in).
2. Different IP → different `ip_hash` → email should fire.

**C. Read the live edge logs.**
- Supabase dashboard → Functions → log-visit → Logs.
- Watch a real visitor's POST. Look for the email-send line in the response (or absence thereof, if `isNewVisitor === false`).

## 4. Suppression still works

- Bot/cloud datacenter cities (`san jose`, `ashburn`, `boardman`, `council bluffs`) still suppressed even on visitNumber === 1. No action needed — confirmed in the function source.

## 5. Edge cases

- **No `ip_hash`** (cookie missing or geo lookup failed) → `visitNumber` defaults to 1 → email fires. Acceptable: rare, and we'd rather over-alert than miss a real visit.
- **Race: same hash inserts two rows in microseconds** (unlikely; `logVisit` runs once per pathname useEffect) → both could compute count=0 → both fire. Two emails in worst case. Acceptable.
- **Rolling proxy / VPN giving different IPs** → each new IP's first visit sends one email. Same person could trigger 2-3 emails over a day. Live with it.

## 6. Code references

- `app/moderate/page.tsx` — user-row layout (top: username + chips; bottom muted line: email · joined · last login).
- `supabase/functions/log-visit/index.ts:84` — `if (isNewVisitor && …)` gate.
- `lib/events.ts:33` — `OWNER_EMAILS` skip-list (your two accounts).
- Backfill applied via `UPDATE public.profiles … FROM auth.users …`.
