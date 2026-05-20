// Canonical Distemper timeline + calendar helpers.
//
// Anchor: Day 0 = "First Recorded death in Chile" = 2-Mar (Year 0 / 2025).
// In-game years map to real Gregorian years (Year 0 = 2025, Year 1 = 2026,
// etc.) - Year 0 is the pandemic year itself, Year 1 is the first year
// AFTER the pandemic, and so on. The YEAR is implicit in display - shows
// "Year N" with no real-world year, because the launch date isn't fixed
// yet and the world plays out in real time relative to whenever launch
// happens.
//
// Re-locked 2026-05-13 (was Year 1 = pandemic year pre-shift; the
// /stories/new and module-editor canonical-start-date pickers locked
// Year 0 = pandemic year and this file follows suit).
//
// Some Year 2 day numbers in Xero's canonical table are +1 vs strict
// Gregorian math (e.g. 15-Sep = Day 563 per canon, vs Day 562 per strict
// math). We store the canon day numbers AS-IS for event lookup. The
// dayToCalendar() helper uses strict Gregorian - so on-event-day display
// matches the canon table for the date_short field stored on each entry,
// while computed displays for intermediate days may differ by 1 day in
// Year 2. Revisit if cosmetic mismatch becomes a problem.

export interface TimelineEntry {
  canon_day: number
  date_short: string  // Xero's canonical short form, e.g. "15-Sep"
  event: string
}

// Full canonical event list, ordered by canon_day. Source: Xero's
// timeline spreadsheet (2026-05-12). Empty-event rows from the source
// table are dropped - they're placeholders, not events to display.
export const DISTEMPER_TIMELINE: ReadonlyArray<TimelineEntry> = [
  // ── Year 0 (Infection Year - 2025, the pandemic year) ─────────────────────────
  { canon_day: 0,   date_short: '2-Mar',  event: 'First Recorded death in Chile' },
  { canon_day: 7,   date_short: '9-Mar',  event: 'WHO classifies the virus, believing it to be transmission based with a mortality rate just in advance of seasonal flu at 1.3%' },
  { canon_day: 31,  date_short: '2-Apr',  event: 'H724 has infected more people than the common cold' },
  { canon_day: 32,  date_short: '3-Apr',  event: 'Symptoms now reported in 46 countries' },
  { canon_day: 34,  date_short: '5-Apr',  event: 'China closes borders to limit the spread' },
  { canon_day: 35,  date_short: '6-Apr',  event: 'WHO states that the virus has mutated and reclassify it as H724-B, declaring it to be a pandemic with a mortality rate just below 4%' },
  { canon_day: 42,  date_short: '13-Apr', event: 'Symptoms now reported in 73 countries. Testing is still unreliable and no treatment is available' },
  { canon_day: 48,  date_short: '19-Apr', event: 'All international passenger travel is halted' },
  { canon_day: 52,  date_short: '23-Apr', event: 'The IMF reports a global recession is inevitable as supply chains start to become affected' },
  { canon_day: 57,  date_short: '28-Apr', event: 'EU bans movement of livestock' },
  { canon_day: 61,  date_short: '2-May',  event: 'France spearheads an international coalition of research teams to speed up development of a cure' },
  { canon_day: 70,  date_short: '11-May', event: 'Swedish scientists provide the French coalition team data that allows for the development of rapid testing capabilities.' },
  { canon_day: 77,  date_short: '18-May', event: 'WHO note a new mutation noted H724-c that they believe to be Zoonotic, transmitted from dogs and pigeons. Many countries begin immediate culls of those animals. The mortality rate is again revised upwards to 19%' },
  { canon_day: 81,  date_short: '22-May', event: 'Many countries, unable to cope with the death rate create mass graves that are visible from satellite' },
  { canon_day: 83,  date_short: '24-May', event: 'China starts central corpse disposal, the fires can reportedly be seen from Taiwan' },
  { canon_day: 84,  date_short: '25-May', event: 'UK closes all public buildings' },
  { canon_day: 85,  date_short: '26-May', event: 'Korea conducts nationwide blood tests and moves the infected into "contagion camps"' },
  { canon_day: 89,  date_short: '30-May', event: 'The CDC advises the quarantine of New York State as it is the epicenter of the outbreak in the US' },
  { canon_day: 95,  date_short: '5-Jun',  event: 'Half a million are dead, several smaller and more isolated countries close their borders and declare quarantine' },
  { canon_day: 98,  date_short: '8-Jun',  event: 'After riots and other panic-led behavior of its people, America introduces martial law and institutes a complete lock-down of its people, closely followed by Europe, Canada, Australia and many other countries to try and prevent further contagion and spread of the disease' },
  { canon_day: 100, date_short: '10-Jun', event: '"Contagion" camps are setup all over the world after the apparent success in South Korea' },
  { canon_day: 101, date_short: '11-Jun', event: 'The UN and WHO align research doctors the world over underneath the French team' },
  { canon_day: 105, date_short: '15-Jun', event: 'Korea exterminates pigeons and dogs' },
  { canon_day: 110, date_short: '20-Jun', event: 'Test medicines in UK initially seem to slow symptoms but cannot stop infection' },
  { canon_day: 114, date_short: '24-Jun', event: "Reports emerge of China's burning mass graves" },
  { canon_day: 116, date_short: '26-Jun', event: 'Life in Iceland has completely broken down leading to riots throughout Europe' },
  { canon_day: 118, date_short: '28-Jun', event: "WHO note the virus's fourth mutation H724-d, with a mortality rate of almost 40%" },
  { canon_day: 123, date_short: '3-Jul',  event: 'WHO estimates determine H724-d has killed more than the Spanish Flu' },
  { canon_day: 129, date_short: '9-Jul',  event: 'China approves human experimentation' },
  { canon_day: 136, date_short: '16-Jul', event: 'WHO estimates determine H724-d has killed more than the Smallpox' },
  { canon_day: 139, date_short: '19-Jul', event: 'America closes all ports and declares Martial Law and quarantines all cities, almost every nation on Earth quickly follows suit' },
  { canon_day: 140, date_short: '20-Jul', event: 'UN and WHO remove drug research safeguards' },
  { canon_day: 142, date_short: '22-Jul', event: 'Natural Infection levels complete' },
  { canon_day: 156, date_short: '5-Aug',  event: 'Fifth mutation noted H724-e' },
  { canon_day: 158, date_short: '7-Aug',  event: 'Mickey Mouse Murdered My Mom' },
  { canon_day: 165, date_short: '14-Aug', event: "TVs Stopped Working" },
  { canon_day: 206, date_short: '24-Sep', event: 'Nuclear explosion in Finland has released a vast cloud of radioactive particles' },
  { canon_day: 211, date_short: '29-Sep', event: "Martial Law in the US starts to fail as there aren't enough people in uniforms left to help" },
  { canon_day: 216, date_short: '4-Oct',  event: 'Europe falls into Anarchy' },
  { canon_day: 229, date_short: '17-Oct', event: 'French-led research team have introduced synthetic genes into H724 and believe they are close to a cure' },
  { canon_day: 231, date_short: '19-Oct', event: 'Sixth Mutation noted h274-F' },
  { canon_day: 234, date_short: '22-Oct', event: "H274-f's infective properties include reigniting the symptoms of previously sick" },
  { canon_day: 240, date_short: '28-Oct', event: 'French-led research team have lost too many members for any research to be meaningful' },
  { canon_day: 245, date_short: '2-Nov',  event: 'No functioning world governments remain' },
  { canon_day: 246, date_short: '3-Nov',  event: 'The Irresistible Force' },
  { canon_day: 297, date_short: '24-Dec', event: 'Infection complete.' },

  // ── Year 1 (The Year After - 2026) ─────────────────────────
  { canon_day: 305, date_short: '1-Jan',  event: 'Apex of the pandemic' },
  { canon_day: 315, date_short: '11-Jan', event: 'To Hunker In the Bunker' },
  { canon_day: 362, date_short: '27-Feb', event: 'Empty' },
  { canon_day: 379, date_short: '15-Mar', event: 'Chased (Day 1)' },
  { canon_day: 380, date_short: '16-Mar', event: 'Chased (Day 2)' },
  { canon_day: 408, date_short: '13-Apr', event: 'Home By The Sea - Arrival of Jace & Dulce' },
  { canon_day: 409, date_short: '14-Apr', event: 'Home By The Sea - The Rescue of Janice / The power struggle' },
  { canon_day: 410, date_short: '15-Apr', event: 'Home By The Sea - Canvasing the area' },
  { canon_day: 480, date_short: '24-Jun', event: 'On The Waterfront' },
  { canon_day: 563, date_short: '15-Sep', event: 'The Magnificent Mongrels' },
  { canon_day: 573, date_short: '25-Sep', event: 'Bad Faith Negotiations' },
  { canon_day: 633, date_short: '24-Nov', event: 'A Month In Hell' },

  // ── Year 2 (Two Years On - 2027) ───────────────────────────
  { canon_day: 791, date_short: '1-May',  event: "Our Father's House" },
  { canon_day: 855, date_short: '4-Jul',  event: 'Greatest City on Earth' },
  { canon_day: 919, date_short: '6-Sep',  event: 'The Island' },

  // ── Year 3 (Three Years On - 2028) ─────────────────────────
  { canon_day: 1085, date_short: '19-Feb', event: 'Mongrels' },
  { canon_day: 1095, date_short: '1-Mar',  event: 'Trade Routes of New Philly' },
  { canon_day: 1398, date_short: '29-Dec', event: 'The Procession' },
]

// Lookup: events on a specific canon day. Most days have 0; some
// (e.g. Home By The Sea over 3 consecutive days) have multiple.
export function eventsOnDay(canonDay: number): TimelineEntry[] {
  return DISTEMPER_TIMELINE.filter(e => e.canon_day === canonDay)
}

// All events strictly at or before the current canon day. Used by
// the timeline panel's filtered render (locked rule: never show
// future events). Returns chronologically-ordered entries.
export function pastAndPresentEvents(canonDay: number): TimelineEntry[] {
  return DISTEMPER_TIMELINE.filter(e => e.canon_day <= canonDay)
}

// ── Calendar math ────────────────────────────────────────────
// Strict Gregorian. Epoch fixed at 2 March Year 1.

const EPOCH_UTC_MS = Date.UTC(2025, 2, 2) // month is 0-indexed; 2 = March

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface CalendarParts {
  monthName: string       // e.g. "September"
  day: number             // 1-31
  dayOrdinal: string      // e.g. "15th"
  yearNumber: number      // in-game year (1, 2, 3, ...)
  // formatted: full "Day N / Month Day_ordinal, Year X" string
  display: string
}

function ordinalSuffix(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// Pure function: canon_day → calendar parts. Strict Gregorian via JS
// Date with the fixed epoch above. Year 1 = first calendar year of
// the timeline (containing the epoch); subsequent years increment
// at each Jan 1 boundary.
export function dayToCalendar(canonDay: number): CalendarParts {
  const ms = EPOCH_UTC_MS + canonDay * 86_400_000
  const d = new Date(ms)
  const monthIdx = d.getUTCMonth()
  const day = d.getUTCDate()
  const realYear = d.getUTCFullYear()
  const yearNumber = realYear - 2025  // 2025 → Year 0 (pandemic), 2026 → Year 1, ...
  const monthName = MONTH_NAMES[monthIdx]
  const dayOrdinal = `${day}${ordinalSuffix(day)}`
  const display = `Day ${canonDay} / ${monthName} ${dayOrdinal}, Year ${yearNumber}`
  return { monthName, day, dayOrdinal, yearNumber, display }
}

// 12h clock formatting for the hour-of-day component.
// hour: 0-23 → "12 AM" / "1 AM" / ... / "12 PM" / "1 PM" / ... / "11 PM".
export function hourTo12h(hour: number): string {
  const h = ((hour % 12) + 12) % 12 || 12
  const ampm = hour < 12 || hour >= 24 ? 'AM' : 'PM'
  return `${h} ${ampm}`
}
