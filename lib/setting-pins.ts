// Seed pin data for campaign settings

export interface SettingPin {
  title: string
  lat: number
  lng: number
  notes?: string
  category?: string
}

export const MONGRELS_PINS: SettingPin[] = [
  { title: 'Hells Hole Spring, AZ', lat: 33.5187, lng: -111.3704, category: 'location' },
  { title: 'Canyon Lake Marina & Campground, AZ', lat: 33.5359, lng: -111.4231, category: 'location' },
  { title: 'Apache Junction - E Brown/N Ellsworth, AZ', lat: 33.4151, lng: -111.546, category: 'location' },
  { title: 'Payson, AZ', lat: 34.2309, lng: -111.3251, category: 'location' },
  { title: 'Upper Lake Mary, AZ', lat: 34.9897, lng: -111.5628, category: 'location' },
  { title: 'Lowell Observatory, Flagstaff, AZ', lat: 35.2028, lng: -111.6645, category: 'location' },
  { title: 'Flagstaff, AZ', lat: 35.1983, lng: -111.6513, category: 'location' },
  { title: 'Cameron, AZ (Navajo Nation)', lat: 36.0003, lng: -111.4147, category: 'location' },
  { title: "Cameron Old Bridge (Tanner's Crossing)", lat: 36.0047, lng: -111.4139, category: 'location' },
  { title: 'Page, AZ', lat: 36.9147, lng: -111.4558, category: 'location' },
  { title: 'Glen Canyon Dam, AZ', lat: 36.9369, lng: -111.4839, category: 'location' },
  { title: 'Kanab, UT', lat: 37.0475, lng: -112.5263, category: 'location' },
  { title: 'Cedar City, UT', lat: 37.6775, lng: -113.0619, category: 'location' },
  { title: 'Cedar Breaks National Monument, UT', lat: 37.6428, lng: -112.8369, category: 'location' },
  { title: 'Holden, UT', lat: 39.0994, lng: -112.2688, category: 'location' },
  { title: 'Provo, UT', lat: 40.2338, lng: -111.6585, category: 'location' },
  { title: 'Salt Lake City, UT', lat: 40.7608, lng: -111.891, category: 'location' },
  { title: 'Logan, UT', lat: 41.7353, lng: -111.8349, category: 'location' },
  { title: 'Pocatello, ID', lat: 42.8713, lng: -112.4455, category: 'location' },
  { title: 'Idaho Falls, ID', lat: 43.4917, lng: -112.0339, category: 'location' },
  { title: 'Monida Pass, MT/ID border', lat: 44.5583, lng: -112.3055, category: 'location' },
  { title: 'Dillon, MT', lat: 45.2158, lng: -112.6369, category: 'location' },
  { title: 'Homestake Pass, MT', lat: 45.9221, lng: -112.4161, category: 'location' },
  { title: 'Bozeman, MT', lat: 45.677, lng: -111.0429, category: 'location' },
]

export const DISTRICT_ZERO_PINS: SettingPin[] = [
  // ── GATES ──
  { title: 'West Gate', lat: 36.0526, lng: -95.7978, category: 'military', notes: 'Primary entrance for non-residents. Guards search all visitors. Non-residents enter here only. West Broadway & S Elm Place.' },
  { title: 'North Gate', lat: 36.0580, lng: -95.7902, category: 'military', notes: 'Northern entrance/exit. W Kenosha St & N Main St. Residents can use freely within curfew rules.' },
  { title: 'South Gate', lat: 36.0452, lng: -95.7902, category: 'military', notes: 'Southern entrance/exit. Houston St & S Main St. Near the Performing Arts Center.' },
  { title: 'East Gate (Farm Gate)', lat: 36.0505, lng: -95.7782, category: 'military', notes: 'Separates District Zero from District One (the Farm). E College St & County Line Rd. Always has at least two guards plus a watchtower sniper.' },

  // ── WATCHTOWERS ──
  { title: 'Watchtower — NW Corner', lat: 36.0578, lng: -95.7978, category: 'military', notes: 'Corner watchtower. Battery-powered radio, siren, and powerful flashlight. Constant comms with City Hall shift leader.' },
  { title: 'Watchtower — NE Corner', lat: 36.0578, lng: -95.7828, category: 'military', notes: 'Corner watchtower. Overlooks the Refinery approach. Battery-powered radio, siren, flashlight.' },
  { title: 'Watchtower — SW Corner', lat: 36.0452, lng: -95.7978, category: 'military', notes: 'Corner watchtower. Covers the rail line crossing. Battery-powered radio, siren, flashlight.' },
  { title: 'Watchtower — SE Corner', lat: 36.0452, lng: -95.7828, category: 'military', notes: 'Corner watchtower. Battery-powered radio, siren, flashlight.' },
  { title: 'Watchtower — North Gate', lat: 36.0580, lng: -95.7895, category: 'military', notes: 'Covers the North Gate. Sharpshooter always on duty.' },
  { title: 'Watchtower — West Gate', lat: 36.0528, lng: -95.7978, category: 'military', notes: 'Covers the West Gate. Primary public-facing tower.' },
  { title: 'Watchtower — South Gate', lat: 36.0452, lng: -95.7896, category: 'military', notes: 'Covers the South Gate. Sharpshooter always on duty.' },
  { title: 'Watchtower — East Gate', lat: 36.0507, lng: -95.7800, category: 'military', notes: 'Covers the Farm gate. Extra vigilance due to distance from the Mile.' },

  // ── NAMED LOCATIONS ──
  { title: '01 | City Hall', lat: 36.0510, lng: -95.7900, category: 'government', notes: 'Center of all official business. Lincoln Sawyer and Mitch Kosinski both keep offices here. Deputies use this as their HQ. Secure holding area in the basement (capacity 12). Has served as a courthouse. S Main St near W Commercial St.' },
  { title: "02 | Farmer's Market", lat: 36.0555, lng: -95.7904, category: 'business', notes: "Overseen by Tom Orchard. Central meeting point for trade. Up to 30+ vendors on busy days. Deputies always visible. Currency: bullets and batteries. No tax but the district expects a cut. N Main St area." },
  { title: '03 | Main Street Tavern', lat: 36.0512, lng: -95.7898, category: 'business', notes: "Run by Jemimah Sawyer (Lincoln's former daughter-in-law). Open noon until last call. Moonshine and grain alcohols. Cooked food available. Community social hub. S Main St." },
  { title: '04 | The Bike Shop', lat: 36.0507, lng: -95.7897, category: 'business', notes: 'Run by Emma Hernandez. Primary transport repair for the Mile. Open to the public two days a week. Emma also scavenges for parts. S Main St near W Dallas St.' },
  { title: '05 | The Clinic', lat: 36.0520, lng: -95.7838, category: 'medical', notes: "Run by Morgan Lieu (vet tech — closest thing to a doctor the Mile has). Multiple exam rooms and beds. Heavy reliance on herbal remedies due to supply scarcity. N 5th St area, east side of the Mile." },
  { title: '06 | The Vault', lat: 36.0513, lng: -95.7901, category: 'resource', notes: "Converted bank. Central storage facility. Deputies' armory inside. Wesley Spencer manages district supplies. Key-operated locks — no power to electronic systems. Deputies patrol start/end here. Near City Hall and the Tavern." },
  { title: '07 | The Kitchen', lat: 36.0515, lng: -95.7899, category: 'community', notes: "Run by Nana Welch and her 'angels' (volunteers). Converted restaurant kitchen. One meal per resident per day, served at sundown. Borders Centennial Park. S Main St." },
  { title: '08 | The College', lat: 36.0520, lng: -95.7897, category: 'community', notes: 'Run by Carol Philips. Converted private facility for advanced education. Practical adult classes: gardening, farming, house repairs, bike maintenance. Coordinated with the School for children. S Main / Broadway area.' },
  { title: '09 | The Workshop', lat: 36.0527, lng: -95.7938, category: 'business', notes: 'Run by Nate Landry. Communal tools and equipment. Small generator powers the tools. Free for residents, fee for outsiders based on complexity. Nate is planning a bullet factory here. W Detroit St area.' },
  { title: '10 | First Church of the District', lat: 36.0505, lng: -95.7901, category: 'location', notes: "Run by Father Donalds. Originally a parish — renamed to non-denominational 'First Church of the District' to promote inclusion, which backfired and split the congregation. Sunday services. Community potlucks. S Main near E College St." },
  { title: '11 | Chamber of Commerce', lat: 36.0535, lng: -95.7905, category: 'government', notes: 'Administrative hub. Wesley Spencer operates here. Monthly city council meetings (capacity 150). Tom Orchard has an office here too. N Main St area.' },
  { title: '12 | The Rose Rooms', lat: 36.0530, lng: -95.7908, category: 'residence', notes: 'Converted apartment building, run by Marcy Cunningham. 55 furnished apartments, multiple beds each. Cost: 20 bullets or batteries/night. Heated rooms extra (5 bullets/person/night). Visitor permit required to reserve. Marcy lives onsite and accepts cigarettes (though Wesley disapproves). N Main area near W Elgin St.' },
  { title: "13 | Nate's Auto Shop", lat: 36.0558, lng: -95.7910, category: 'business', notes: "Run by Johnson Walker. Converts vehicles to run on biofuel from the Refinery. Maintains patrol cars, motorbikes, trucks, and farm equipment. Vehicles stored behind the shop. Requires Wesley's authorization to borrow a vehicle. N Main/Ash area." },
  { title: '14 | Church of Christ', lat: 36.0572, lng: -95.7852, category: 'location', notes: "Breakaway congregation led by lay preacher Milo Cantwell. Fire-and-brimstone sermons. Members refusing work rosters and isolating from the community — a growing concern for Lincoln and Mitch. Deputies instructed to watch this area closely. NE corner near N 4th St." },
  { title: '15 | The Refinery', lat: 36.0575, lng: -95.7832, category: 'resource', notes: "Run by Gio Leone. Produces ethanol and methanol biofuel from organic matter. Powers vehicles, lamps, lights, and furnaces. Critical infrastructure. Highly volatile during operation — fire risk. Always has at least one deputy and watchtower 4 oversight. Far NE corner of the Mile." },
  { title: '16 | The School (Broken Arrow Academy)', lat: 36.0462, lng: -95.7830, category: 'community', notes: "Run by Jeremy Barrow and volunteer educators. Roughly 60 school-age children. Math, geography, history, literature, and practical skills. Jeremy has gathered almost all library books into the school. SE corner of the Mile." },

  // ── DISTRICT ONE (THE FARM) ──
  { title: '17 | The Farm (District One)', lat: 36.0530, lng: -95.7820, category: 'location', notes: 'District One. Nearly 350 acres of converted farmland east of the Mile. Managed by David Battersby. Chickens, cattle, crops. A planned hydroponics warehouse is in discussion. Primary food source for the Mile.' },
  { title: "18 | David's Farmhouse", lat: 36.0462, lng: -95.7800, category: 'residence', notes: "David Battersby's residence on the southeast corner of the Farm. He lives close to the land by choice." },
  { title: '19 | The Greenhouse', lat: 36.0500, lng: -95.7840, category: 'resource', notes: 'Proposed hydroponics facility in a converted District One warehouse. David and Gio are planning this to grow fruit and vegetables in a controlled environment. Not yet operational.' },
]

export const CHASED_PINS: SettingPin[] = [
  // PART 1: THE FOREST
  { title: 'Redden State Forest Fire Station', lat: 38.7312, lng: -75.5098, category: 'location',
    notes: 'Player camp at the start of Chased. Edge of Redden State Forest along Route 213. Group camps here for the night on their way east to the coast.' },
  { title: 'The Encounter — Forest Clearing', lat: 38.7285, lng: -75.5085, category: 'location',
    notes: 'Where players first hear Maddy crashing through the forest. Clearing near a small stream. Luke Connor catches up with Maddy here. Site of the first combat.' },
  { title: "Owen Connor's Ambush Point", lat: 38.7230, lng: -75.5060, category: 'location',
    notes: 'Half a mile from the Connor farmhouse. Owen flanks the group here on their way to rescue Maddy\'s children. A windmill is visible nearby.' },

  // PART 2: THE FARMHOUSE
  { title: 'Connor Boys Farmhouse', lat: 38.7198, lng: -75.5042, category: 'location',
    notes: 'Multi-generation Connor family home. Soundproofed basement used as a holding area. Two entrances — front and back, both unlocked. Donnie and Junior in the kitchen. Silas in the basement. Maddy\'s children Troy and Mark locked in a ground-floor bedroom next to the kitchen. Windows have bars on that room. Ray and Jackie are out searching during this section.' },
  { title: 'Connor Boys Farm & Fields', lat: 38.7185, lng: -75.5030, category: 'location',
    notes: 'Working farm adjacent to the farmhouse. Livestock and tended fields. Recently tended and in better shape than many local farms. Potential player base if the Connors are dealt with.' },

  // PART 3 & 4: THE MALL
  { title: '01 | Best Nite Motel', lat: 38.6958, lng: -75.5142, category: 'residence',
    notes: 'Home base for Maddy\'s group. 14 residents. Group dinners at the rear fire pit — the direction the Connors attack from in Part 4. Plenty of rooms still available. Starting location for the Crossroads Chronicles campaign.' },
  { title: "02 | Belvedere's Outdoor Supply", lat: 38.6955, lng: -75.5130, category: 'business',
    notes: 'Outdoor supply store in the King\'s Crossroads Mall complex. Still contains useful supplies. Largely untouched due to the mall\'s out-of-the-way location and incomplete construction at time of pandemic.' },
  { title: '03 | Drop By Urgent Care', lat: 38.6950, lng: -75.5118, category: 'medical',
    notes: 'Urgent care clinic in the mall complex. Medical supplies available. Not fully looted.' },
  { title: '04 | Costco Superstore', lat: 38.6960, lng: -75.5125, category: 'resource',
    notes: 'The group\'s primary food source. Pallets of tinned food the residents believe will last several more weeks. Construction tools and materials also present from the incomplete mall build.' },
  { title: '05 | Tri-State Firearms & Shooting Range', lat: 38.6956, lng: -75.5138, category: 'business',
    notes: 'Firearms store and shooting range. Significant find for a group needing weapons and ammunition.' },
  { title: "06 | Swiss Tony's Used Car Lot", lat: 38.6963, lng: -75.5148, category: 'location',
    notes: 'Used car lot on the mall perimeter. Potential source of vehicles or parts.' },
  { title: '07 | RoadCo Gas Station', lat: 38.6968, lng: -75.5155, category: 'resource',
    notes: 'Gas station at the edge of the King\'s Crossroads Mall property. Potential fuel source.' },

  // REFERENCE
  { title: 'Georgetown, DE', lat: 38.6896, lng: -75.4974, category: 'location',
    notes: 'Town approximately one hour south. 500+ people in a loose collective who consider the King\'s Crossroads Mall their territory. Will not be happy to find players and NPCs living there. Further detailed in the Crossroads Chronicles sourcebook.' },
]

export const SETTING_PINS: Record<string, SettingPin[]> = {
  district_zero: DISTRICT_ZERO_PINS,
  chased: CHASED_PINS,
  mongrels: MONGRELS_PINS,
}
