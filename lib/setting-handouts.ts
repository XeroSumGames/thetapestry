// Seed handout data for campaign GM notes

export interface HandoutSeed {
  title: string
  content: string
}

export const EMPTY_HANDOUTS: HandoutSeed[] = [
  {
    title: 'Empty — Session Zero',
    content: `WHAT THE PLAYERS KNOW
Read or paraphrase the following to the group before play begins:

"It has been almost a year since you first heard of the dog flu. You are all friends, family, or acquaintances of David Battersby and have been waiting the pandemic out on his farm. Your efforts in pulling together as a small group of survivors attempting to be self-sufficient have worked so far — you have all had enough to eat and, minor frustrations aside, no one has come to blows.

But one of the tractors recently broke and needs an arc welder to be repaired. David believes there is a garage nearby that might have one and, as none of you have left the farm in nearly two months, you all jumped at a chance to go. A few of you take his truck and leave after breakfast.

This is the first time anyone has ventured off the farm in months and the drive was a sobering experience. The complete lack of life reminds you how absolute the devastation of the dog flu has been. Someone suggested stopping at empty houses along the way to see if there was anything worth scavenging, but one house was enough to starkly remind the group of the horrors recently inflicted upon the world and you kept on moving.

There is another 25 somber minutes of driving through a couple of small towns and down some country roads before you see the gas station that David mentioned lies ahead."

---

FILLING IN THE GAPS
Ask each player to tell the group at least one detail about what their character saw on the drive. Prompts:
- Did they see abandoned cars?
- Were buildings intact or damaged?
- Were any burned out shells?
- Did things look looted or eerily normal?
- Were there remains of the dead?
- Were any lights on in buildings?
- Did they see any stores worth stopping at on the way back?

---

WHAT THE GM KNOWS ABOUT THE GAS STATION
The station was owned by Errol and Martina Stansfield for almost 15 years. In addition to fuel and the general store, Errol had a tow truck and a well-equipped workshop. The two lived quietly and happily until dying at home in excruciating pain within days of each other. Due to the low local population and the secluded nature of the station, it has remained untouched. The general store is largely intact but most contents are expired or rotten.

Inside is Becky, late 20s. She and Dylan, early 30s, arrived late the previous night and slept on the pull-out couch in the breakroom. Dylan went hunting that morning and will return shortly after the players encounter Becky. Dylan used more ammunition than intended while hunting and has only 3 bullets left when he returns. More ammo is in Becky's bag on the counter. They also have a shotgun in their truck with 2 shells.`,
  },
]

export const SETTING_HANDOUTS: Record<string, HandoutSeed[]> = {
  empty: EMPTY_HANDOUTS,
}
