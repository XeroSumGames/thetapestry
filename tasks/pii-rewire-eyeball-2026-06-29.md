# PII Reader Rewire - In-App Eyeball (2026-06-29)

Live (give Vercel ~2 min after the push): https://thetapestry.distemperverse.com
This is the "does everything still show before PF revokes the columns" check.
Just do each step and report back what you saw.

## Email (3)
1. Go to your Account page. Look at the email field.
2. Open the Bug Report button (sidebar), look at it / submit a quick test report.
3. As a Thriver, open the moderation view of some user's characters
   (/moderate -> a user -> their characters). Look for that user's email.

Report back: whether your email shows on Account, whether the bug report
submits, and whether the moderation page shows the target user's email.

## Invite code / join (the bigger set)
4. Go to "My Stories". Look at each campaign card's Invite Code text and click a
   "Share" button on one.
5. Open a story's GM hub page (/stories/<id>) - look at the Invite panel (link + code).
6. Open the table page for a campaign you GM. Click the campaign menu -> "Share",
   and (GM) the "Observer Link" button.
7. In an incognito/other window, paste an invite link (/join/<CODE>) and confirm
   it finds the story and lets you join. Also try /stories/join and type a code.
8. On a campaign's Community and Sessions pages, look for the invite/share link.

Report back: whether the invite code shows on the My Stories cards, whether Share
copies a working link, whether the hub + table + community + sessions all show
the code/link, and whether joining by code (both the /join/<code> link and the
typed-code form) works.

## After you confirm
Once the above looks good, PF applies the column revoke and re-verifies by
impersonation (see `tasks/finding-pii-revoke-readiness-2026-06-29.md` - there's
one select('*') item for PF to confirm in that pass). Fully reversible.
