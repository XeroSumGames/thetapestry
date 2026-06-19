# TheTapestry Full E2E Checklist - Test Plan
Generated: 2026-06-13

## What this is

307-step pass/fail checklist covering every documented feature across:
- Beginners' Guide Ch1-Ch14 (14 docs)
- Tactical Map Guide V2.0
- GM Guide: Tactical Scene Setup V2.0

**Source file:** `tasks/tapestry-e2e-checklist.xlsx`

## How to run it

Open the Excel file. Work top to bottom. For each numbered row:
- Do the action in column C
- Compare what you see against the expected result in column D
- Type PASS or FAIL in column E
- Use column F for any notes (what you actually saw on a FAIL)

## Structure

| Section | Steps | Focus |
|---|---|---|
| 0 - Account Setup | 1-3 | Navigate to site, create account, confirm landing |
| 1 - Navigating the Site | 4-24 | Sidebar, user panel icons, all 9 nav destinations, 4 character creation entry points |
| 2 - Pins, Notifications, Roles | 25-29 | Notification list, mark-all-read, delete-all, click-to-navigate |
| 3 - The World Map | 30-47 | Pan/zoom/search, map styles, Pins Panel, placing a pin |
| 4 - Creating a Character | 48-72 | All 4 creation methods, character card actions, WP/Stress clicking |
| 5 - The Rules | 73-79 | In-app SRD, section/appendix navigation, direct URL access |
| 6 - Creating a Story | 80-95 | Create, invite code, action buttons, join/leave, Rumor clone |
| 7 - The Table and Sessions | 96-128 | Table header, session lifecycle, logs/chat/both, dice rolling, Advantages, XSE ladder |
| 8 - Tactical Map and Fog of War | 129-173 | All Map Setup controls, token types, walls/doors/windows, fog, pinging, sharing |
| 9 - Combat | 174-209 | Full combat flow, all 15 actions, grapple/subdue/break free, mortal wounds, lasting wounds, env damage |
| 10 - NPCs and Recruitment | 210-235 | NPC CRUD, generate/populate, show/hide, recruitment 3 approaches, Apprentice, Token Creator |
| 11 - Vehicles | 236-248 | Seats, boarding/disembark, fuel, brewing, cargo, vehicle bubble |
| 12 - Communities | 249-265 | Create, 13-member threshold, roles, weekly check, morale, dashboard |
| 13 - The Campfire | 266-288 | Portal landing, Messages, LFG, War Stories, Timestamps, Setting Hubs, Community Feed |
| 14 - Rumors Marketplace | 289-307 | Browse/sort/filter, subscribe, clone, publish, versioning, reviews, visibility |

## Prerequisites

- Two test accounts: one GM (Thriver preferred for Thriver-auto-approve), one Survivor (player)
- At least one existing campaign with NPCs (The Arena is fine for read-only; use a throwaway for destructive steps)
- Access to the live site: thetapestry.distemperverse.com

## Notes for running

- Steps that require two accounts are flagged in the Action column ("As another user..." / "In a second (player) account...")
- Steps that require an active session are marked "(active session)" or "(GM)"
- Steps 163, 89 are destructive (delete scene / delete story) - run these last within their section
- Step 197 (reduce PC to 0 WP) is best done on a throwaway character in a throwaway campaign
- The Vehicles section (236-248) requires a campaign that has a vehicle already created

## Reporting failures

When you hit a FAIL, note in column F:
- What you actually saw
- URL you were on
- Any error messages or console output

Route FAIL findings to the appropriate lane:
- UI rendering / feature broken -> Hunt & Peck
- DB / RLS / trigger issue -> Puffer Fish
- Playwright test gap found -> Playwright / E2E lane
