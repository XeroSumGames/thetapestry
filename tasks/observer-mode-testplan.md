# Observer mode fix - test plan (2026-06-22)

Use a SECOND account (not the GM account) for the observer - the GM always
renders as GM. Easiest: a second browser or an incognito window logged in as
a player/test account that is NOT the campaign's GM.

## Setup
1. In your GM account, open the story table and copy the **Observer Link**
   from the table menu (the one that says "share it with whoever should watch").

## Test A - brand-new observer (account not yet in the campaign)
2. In a second browser/incognito, log in as an account that has never joined
   this campaign.
3. Paste the observer link into the address bar and press Enter.
4. On the "Join as Observer" screen, confirm the code is filled, click
   **JOIN AS OBSERVER**.
5. Report back: where did it land you, and what did you see on that screen?

## Test B - observer link used by someone already in the campaign
6. Still in the second browser, go to the story lobby for this campaign
   (My Stories -> the story).
7. Report back: what badge shows under the story title, and what does the
   left side of the lobby show (a survivor picker, or an observer message)?
8. Open the table (Launch). Report back: does this account show up in the
   player bar at the bottom of the GM's table view?

## Test C - GM's view is unaffected
9. Back in your GM account, open the same story lobby.
10. Report back: what badge shows under the title, and do you still see the
    GM tools / story settings as before?
