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

export const SETTING_SCENES: Record<string, SceneSeed[]> = {
  chased: CHASED_SCENES,
}
