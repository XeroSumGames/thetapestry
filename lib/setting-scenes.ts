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

export const MONGRELS_SCENES: SceneSeed[] = [
  {
    name: 'Minnie — Interior',
    grid_cols: 13,
    grid_rows: 4,
    notes: 'Interior floor plan of the Winnebago Minnie Winnie 25B. Each cell is 2 feet. Upload the floor plan image as the background.\n\nLayout (left-to-right = rear-to-front of vehicle):\n\nRow 1 (driver side / top):\n- Cols 1-2: Shower (23"x34")\n- Col 3: Wardrobe\n- Cols 4-5: Kitchen (stove/sink)\n- Cols 6-9: Sofa/Bed (40"x67")\n- Cols 10-13: Overhead Bed / Cab (57"x95")\n\nRow 2-3 (center aisle):\n- Cols 1-3: Bed (54"x80")\n- Col 4: Door (entry/exit — step well)\n- Cols 5-6: Refrig\n- Cols 7-9: Dinette (42"x69")\n- Cols 10-13: Cab area\n\nRow 4 (passenger side / bottom):\n- Cols 1-2: TV Location / Bed area\n- Col 3: Shirt Closet\n- Cols 4-5: Step Well / Entry Door\n- Cols 6-9: Dinette seating\n- Col 10: TV Location\n- Cols 11-13: Cab / Passenger seat\n\nKey tactical notes:\n- Entry door at col 4, passenger side — only normal exit\n- Rear ladder (exterior) — access to sniper\'s nest on roof\n- Sniper\'s nest: roof hatch above col 2, fires forward 90-degree arc only\n- Still equipment: rear cargo area, cols 1-2\n- Narrow interior — movement is single-file in the aisle\n- Reinforced windows deflect low-calibre rounds at distance',
  },
  {
    name: 'The Barn — Day One',
    grid_cols: 20,
    grid_rows: 15,
    notes: 'The compound workshop where Minnie is parked. Players are inside preparing the Winnebago when Kincaid arrives.\n\nLayout: The barn is a large open workshop with Minnie (the Winnebago) parked inside. A single large door opens onto the compound yard. The main house and barracks are across the yard — visible but not reachable without being seen by Kincaid\'s men.\n\nKey locations:\n- Workshop interior — tools, spare parts, the still components being loaded\n- Barn door — view to the yard where Kincaid confronts Frankie\n- Minnie — players must load supplies and disconnect the still\n\nSequence:\n1. Players hear vehicles approach — Kincaid arrives with Justice Morse and a dozen soldiers\n2. Frankie goes out to talk while players prep Minnie (Mechanic*/Tinkerer check to disconnect still)\n3. Kincaid executes a hostage, then Frankie. Frankie drops a live grenade (4-square blast)\n4. Quintin and Forrest fire RPGs at the house and barracks\n5. Players must get Minnie out through the barn door and past Kincaid\'s confused men (Driving check)\n6. Chase sequence — Kincaid\'s jeep (Speed 4) pursues Minnie (Speed 2) until the Apache Junction territorial line\n\nStarting positions:\n- Players: inside the barn, around Minnie\n- Frankie: moves to the yard when Kincaid arrives\n- Kincaid + Justice Morse: yard, facing the barn\n- Kincaid\'s soldiers: spread around compound perimeter',
  },
]

export const SETTING_SCENES: Record<string, SceneSeed[]> = {
  chased: CHASED_SCENES,
  empty: EMPTY_SCENES,
  mongrels: MONGRELS_SCENES,
}
