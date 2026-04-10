// Seed scene data for campaign tactical maps

export interface SceneSeed {
  name: string
  grid_cols: number
  grid_rows: number
  notes: string
}

export const CHASED_SCENES: SceneSeed[] = [
  {
    name: 'Connor Boys Farmhouse',
    grid_cols: 20,
    grid_rows: 15,
    notes: 'Rooms: Kitchen (north), Dining Room (center), Living Room (east), Front Room (south center), five Bedrooms, Basement (accessed from Dining Room).\n\nStarting NPC positions:\n- Donnie McHenry — Kitchen\n- Junior Connor — Kitchen\n- Silas McHenry — Basement\n- Troy and Mark Bell — back Bedroom adjacent to Kitchen (door locked, requires Physicality check to break open)\n\nWindows around ground floor are closed but unlocked except the children\'s room which has bars. Climbing the exterior requires Athletics check at -2 CMod in the dark. A Stealth check is needed each time players move room to room — failure alerts Donnie and Junior. Silas takes 5 rounds to reach ground floor once combat starts above. Ray and Jackie are absent — out looking for Maddy — and will not return while players are at the house unless players are captured.',
  },
]

export const EMPTY_SCENES: SceneSeed[] = [
  {
    name: "Stansfield's Gas Station",
    grid_cols: 20,
    grid_rows: 15,
    notes: "Eight locations: (1) Gas station entrance — players park truck here. (2) Abandoned car — unlocked, keys inside, battery dead, nothing of value. (3) Dylan's bike — connected to pump, saddlebags contain survival gear. (4) Main entrance — bell above door rings on entry unless players got Wild Success on Stealth. (5) Staff area/breakroom — pullout couch, Dylan slept here, cups of instant noodles on shelves. (6) Fire escape rear — unlocked but heavy, makes a lot of noise. (7) Workshop — contains arc welder, tow truck in good condition, starts first attempt. (8) Fire escape side — same as 6.\n\nBecky is in the restroom when players arrive. She emerges moments after they enter. Unless players made significant noise she will not know they are there. She will assume any noise is Dylan returning. Dylan arrives a few minutes after players encounter Becky. He peeks through windows before entering — make Stealth check 2d6+2+1. Front door bell: players can make Perception check to notice it, then Tinkerer check to disable it. Fire escape has second bell — same process. Workshop doors are locked and require Physicality check at -3 CMod as group check to force open — will make huge noise.",
  },
]

export const SETTING_SCENES: Record<string, SceneSeed[]> = {
  chased: CHASED_SCENES,
  empty: EMPTY_SCENES,
}
