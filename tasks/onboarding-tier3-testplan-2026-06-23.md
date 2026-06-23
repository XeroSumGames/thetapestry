# Onboarding (Tier 3) - Test Plan (2026-06-23)

Live (give Vercel ~2 min after push): https://thetapestry.distemperverse.com

## A. Join-a-Story discoverability (cold signup)

1. Log in (or use a fresh account that is NOT in any campaign) and go to the
   dashboard / home.
2. Look at the empty-state screen ("Your Story Starts Here").
3. In the left sidebar, look at the list under "My Stories".

Report back: whether you see a "Join a Story" option in the dashboard empty
state (near the "Create Your First Story" button) AND a "Join a Story" link in
the sidebar, and whether clicking either lands you on the invite-code entry page.

## B. Logged-out Random Character (no more infinite spinner)

1. Open a private/incognito window (logged OUT).
2. Go to https://thetapestry.distemperverse.com/characters/random
3. Wait a few seconds.

Report back: whether you get an account-prompt ("Become a Survivor" / "Create an
account...") instead of an endless row of pulsing dots, and whether the Create
Account / Sign In buttons work.

## C. Creation-path framing (don't lead first-timers into the hardest path)

1. Logged in, open the sidebar "Survivors" section and note the ORDER and which
   creation link is color-highlighted (has a colored left bar).
2. Go to the "Creating a Survivor" page and look at the three method cards'
   tags/badges.

Report back: in the sidebar, whether "Random Character" is now the highlighted
one (green bar) and listed first, with "Backstory Generation" no longer the lone
highlighted default. On the Creating page, whether "Random Character" carries the
green "Recommended for New Players" badge and "Backstory Generation" now reads
"Full Custom" (instead of "Recommended").

## D. Quick-page text + provenance (regression check)

1. Go to /characters/quick and step through the Quick Build screens.
2. Look at the "Attributes - N CDP remaining" / "Skills - N CDP remaining"
   headers and the per-skill rows.

Report back: whether any garbled "?" / diamond characters appear where a dash or
separator should be (there should be none - all plain hyphens now). No action
needed on the saved-character side; the creation-method stamp fix is internal.
