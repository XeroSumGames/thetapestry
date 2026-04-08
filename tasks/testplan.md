# Test Plan: Instant End Session

## What Changed
- `endSession()` now updates all local state (modal close, combat clear, rolls/chat clear, status → idle) **immediately**
- All Supabase DB writes (campaign update, session row, file uploads, log cleanup) run in the background
- No more 30-second wait — UI reflects the ended session instantly

## Steps to Verify

### 1. End Session speed (no combat)
- Start a session, make some rolls, send chat messages
- Click **End Session** → fill in summary fields → click **End Session**
- **Verify**: Modal closes instantly, UI shows idle state with no delay
- **Verify**: Rolls and chat are cleared immediately

### 2. End Session speed (with combat)
- Start a session, start combat with entries in initiative
- Click **End Session**
- **Verify**: Modal closes instantly, combat tracker disappears, initiative clears

### 3. Session data saved correctly
- After ending a session, navigate to **Sessions** page
- **Verify**: The session row has the correct `ended_at`, summary, notes, and cliffhanger
- **Verify**: Any uploaded attachments are present

### 4. Player sees session end
- Have a player connected to the table
- As GM, end the session
- **Verify**: Player's UI updates (session idle, logs cleared) without refresh

### 5. Start new session after ending
- After ending, click **Start Session**
- **Verify**: New session starts cleanly with empty logs/chat
