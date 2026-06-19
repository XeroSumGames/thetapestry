# Test Plan: Pregen DB Seed + /pregen page DB loading

Covers commit `feat(pregen): seed official pregens to DB + load from DB on /pregen`

---

## What changed

1. 6 official pregens seeded to `pregen_library` with `author_id=null`, `moderation_status='approved'`
2. `/pregen` page now loads Official section from DB (not hardcoded)
3. Community section excludes official rows
4. `/moderate?section=pregens` shows "Official" for system records + Edit button on all rows

---

## Steps

1. Go to `thetapestry.distemperverse.com/pregen`
2. Report what you see in the **Official Characters** section - how many cards, do you see names like David Battersby, Carly McIntyre, Morgan Lieu, Marv Calhoun, Victor Williams, Gus Gonzalez
3. Click **Use this character** on any official card. Report where you end up and whether the character appears in your character list.
4. Go to `thetapestry.distemperverse.com/moderate?section=pregens&filter=approved`
5. Report whether the 6 official pregens appear with "Official" as the author name
6. Click **Edit** on any official pregen row. Report what URL you land on and what the page shows.
7. Type a name in the search box on `/pregen`. Report whether the filter works across official cards.

Report back what you saw at each step.
