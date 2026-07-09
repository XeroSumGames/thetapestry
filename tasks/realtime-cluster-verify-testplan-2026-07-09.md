# Realtime channel-fix 2-client verify (2026-07-09)

Confirms the four realtime fixes shipped today didn't break the live table and
actually fixed what they targeted. Needs YOU at two browser windows: one signed
in as the GM, one as a player, both in the same campaign, same story/table.

Wait for the Vercel deploy of today's push to finish first (2-3 min).

## Part A - clock advance no longer hangs (the main one)

1. In the GM window, open the table and start a session.
2. Give a player character a sickness/infection (GM tools -> the infection or environmental-damage control), enough that they have an active infection countdown.
3. Advance the campaign clock far enough that the infection reaches its final day (advance a day at a time until it resolves).
4. Watch the GM window while it advances: note whether the advance completes and the time actually moves, or whether it spins/freezes.
5. In both windows, keep moving a token on the tactical map right after the advance.
6. Reply with: did the clock advance finish, and did token moves still sync between the two windows afterward.

## Part B - pins still propagate

7. In the GM window, reveal a hidden pin on the campaign map.
8. Watch the player window for up to ~30 seconds without touching it.
9. Reply with: did the revealed pin appear on the player's map on its own.

## Part C - vehicle firing-arc toggles cross-window

10. Have a vehicle with a mounted weapon in the campaign.
11. Open the vehicle sheet in one window and the tactical map (showing that vehicle) in the other.
12. In the vehicle sheet, toggle the mounted weapon's firing arc on/off.
13. Reply with: did the firing-arc change show up in the other window.

## Part D - presence count shows table users

14. In the player window, go to the table (a full-screen route).
15. In the GM window, look at the "Survivors present" count/roster at the top of the sidebar (stay on a normal page so the sidebar shows).
16. Reply with: did the player at the table show up in the present count/roster.
