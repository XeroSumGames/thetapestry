# Test Plan: Feed Tab & Session Cleanup

## Changes Made
1. **Default tab** — Feed opens on "Logs" instead of "Both"
2. **Both tab chronological** — Rolls and chat messages are merged and sorted by timestamp
3. **Realtime subscriptions** — `roll_log` and `chat_messages` channels now listen to all events (`*`), not just `INSERT`, so deletions propagate to players
4. **Start Session clears logs** — `startSession()` deletes leftover rolls/chat from DB and clears local state

## Steps to Verify

### 1. Default tab
- Open any story table
- Confirm the feed panel opens on the **Logs** tab (not Both)

### 2. Both tab chronological order
- Start a session, make some rolls and send some chat messages
- Switch to the **Both** tab
- Confirm entries are interleaved chronologically (not all rolls then all chat)

### 3. Clean start on new session
- As GM, click **Start Session**
- Confirm Logs, Chat, and Both tabs are all empty
- As a **player** on the same campaign, confirm their feed is also empty

### 4. Realtime log clearing
- Have a player connected to the table
- As GM, end the session
- Confirm the player's logs/chat clear without needing to refresh
