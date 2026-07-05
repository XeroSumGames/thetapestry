# Test plan - pin reveal/hide reaches players without a refresh (2026-06-30)

Wait ~2 min after the push for Vercel to finish deploying before starting.

You need two browser windows signed in as two different people on the same
District Zero table: one GM (you), one player.

1. In window A, sign in as yourself (GM) and open the District Zero table.
2. In window B, open a second browser (or an incognito window) signed in as a
   player who is a member of that campaign, and open the same table.
3. In window B, make sure you are on the Campaign Map. Then leave window B alone -
   do not click anything, do not switch tabs, do not refresh it. Just let it sit
   where you can see it.
4. In window A (GM), hide a whole folder of pins (e.g. the "Town Buildings"
   reveal/hide control), then about 5 seconds later reveal that folder again.
5. Keep watching window B without touching it. Note whether the pins disappear
   and reappear on their own, and roughly how many seconds each change took.
6. Now repeat once more, this time toggling a single pin's reveal in window A,
   and again watch window B without touching it.

Report back what you saw in window B for each change and roughly how long it took.
