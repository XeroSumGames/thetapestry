# Feature Manifest fix - test plan (2026-07-09)

Covers the data-loss fix on /tools/feature-manifest (saved checklist protected
behind a successful load; counts pruned to the current list).

Wait for the Vercel deploy of today's push to finish first (2-3 minutes after
the push lands).

1. Open https://thetapestry.distemperverse.com/tools/feature-manifest in your normal browser (logged in as your Thriver account).
2. Watch the page as it opens, then let it settle for a few seconds.
3. Note the two numbers at the top (verified count and, if shown, flagged count).
4. Tick 2 or 3 items you have actually verified, and flag 1 item.
5. Wait for the small green "saved to your account" text to appear, then reload the page.
6. Note whether your new ticks and flag are still there.
7. Open the same page in a private/incognito window, log in, and note whether the same ticks show there too.
8. Back in your normal window: turn OFF your wifi (or unplug the network cable), then reload the page.
9. Note what the page shows.
10. Turn the network back on, click the Retry button if one is showing, and note what happens.
11. Reply here with: the counts from step 3, whether ticks survived steps 6 and 7, and what you saw in steps 9 and 10.
