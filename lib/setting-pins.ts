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

export const SETTING_PINS: Record<string, SettingPin[]> = {
  mongrels: MONGRELS_PINS,
}
