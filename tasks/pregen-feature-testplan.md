# PREGEN Feature Test Plan

## Setup
- Need 3 test accounts: Thriver, GM (owns at least one campaign), plain Survivor

---

## 1. PREGEN button - Thriver
1. Log in as Thriver
2. Go to `/characters/new`, build to step 9
3. Report: Is there a PREGEN button between Print and Save?
4. Click PREGEN
5. Report: What toast appears?
6. Go to `/moderate?section=pregens` (filter: approved)
7. Report: Does the new pregen appear?

## 2. PREGEN button - GM
1. Log in as GM account
2. Go to `/characters/quick`, build to step 5
3. Report: Is there a PREGEN button?
4. Click PREGEN
5. Report: What toast appears? Does it say "submitted for approval"?
6. Go to `/moderate?section=pregens` (filter: pending)
7. Report: Does the pregen appear with pending status?

## 3. PREGEN button - plain Survivor
1. Log in as Survivor (no GM campaigns)
2. Go to `/characters/new`, build to step 9
3. Report: Is the PREGEN button absent?

## 4. Moderation queue
1. Log in as Thriver
2. Go to `/moderate` - report: Is there a "Pregens" tab?
3. Click Pregens tab
4. Report: Does the pending count badge show?
5. Approve a pending pregen - report: does it disappear from the list? Does the author get a notification?
6. Reject a pregen - report: does it disappear? Notification sent?

## 5. My Pregens section
1. Log in as the GM account from test 2
2. Go to `/characters`
3. Report: Is there a "My Pregens" section below the character list?
4. Report: Does the pending pregen show with an amber "pending" chip?
5. After Thriver approves it (test 4), reload - does it show green "approved"?

## 6. /pregen page
1. Go to `/pregen` (any user)
2. Report: Do Official Characters and Community Library sections show?
3. Use filters (All / setting chips / search)
4. Click "Use this character" on an approved community pregen
5. Report: Does it create a character and redirect to /characters?

## 7. Story-page pregen picker
1. Join a campaign as a Survivor (no character assigned)
2. Go to the story hub page
3. Report: Is there a "Or Choose a Pre-Generated Character" button?
4. Click it - report: Do official pregens AND community pregens show?
5. Report: Is there a "More pregens ->" link?
6. Click "Select" on a community pregen
7. Report: Is a character created and auto-assigned to the campaign?

## 8. /pregen with return param
1. From a story page, click "More pregens ->"
2. Report: Does `/pregen?return=<storyId>` load?
3. Click "Use this character"
4. Report: Does it redirect back to the story page?

Report back what you saw for each step.
