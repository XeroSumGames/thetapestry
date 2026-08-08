// =============================================================================
// THE ONBOARDING TOUR - the ONE file to edit the welcome tour.
//
// This powers the stepped WelcomeModal shown to new users on /dashboard, and
// replayable any time via the sidebar's "A Guide to the Tapestry" link
// (which opens /dashboard?tour=1).
//
// HOW TO EDIT:
//   * REORDER steps ....... move the { ... } blocks in TOUR_STEPS up or down.
//   * CHANGE a step's text  edit its `title` and the lines inside `body`.
//   * ADD a step .......... copy a 'section' block, change its text + `anchor`.
//   * REMOVE a step ....... delete its block.
//
// Each line in `body` is one paragraph. `list` (optional) adds bullet points
// under the paragraphs. Keep the 'welcome' step first and the 'video' step last
// unless you have a reason to move them.
//
// TEXT FORMATTING - works in WELCOME_PITCH, and in any `body` or `list` string:
//   **like this**   -> bold
//   *like this*     -> italic
// It does NOT work in a step's `title`, or in VIDEO_HEADING / VIDEO_SUBTITLE /
// video labels - asterisks there render literally on screen.
// You cannot combine the two (`***x***` won't bold-italic), the marked text
// can't contain an asterisk, and a marker can't span two paragraphs.
// Apostrophes inside 'single-quoted' strings must be escaped as \' - or just
// use "double quotes" for that string and skip the escaping.
//
// `anchor` (optional) is the part of the app the step points its arrow + box at.
// Leave it off for a step with no on-screen target. The valid anchors, tagged
// in the app's UI:
//   dashboard   - the sidebar's main destination links (as a group)
//   survivors   - the sidebar "My Survivors" link
//   characters  - the sidebar's Survivors creation links (as a group)
//   stories     - the sidebar "My Stories" link
//   communities - the sidebar "My Communities" link
//   campfire    - the sidebar "The Campfire" link
//   rumors      - the sidebar "Rumors" link
//   world       - the world map's "World Events" pins tab
//   pins        - the world map's "My Pins" tab
//   whispers    - the world map's "Whispers" tab
//
// `pos` (optional) pins the modal at fixed screen coords { x, y }. Omit it to
// let the modal auto-place itself beside the anchor. Capture a position by
// opening /dashboard?tour=1&cal=1, dragging the modal, and clicking "copy".
//
// `width` (optional) overrides the modal's width in px for that step only.
// Defaults to TOUR_WIDTH. Use it for steps pinned near the right edge of the
// screen, where the full-width modal would run off.
// =============================================================================

export interface TourVideo { id: string; label: string }

export type TourStep =
  | { kind: 'welcome' }
  | { kind: 'video' }
  | {
      kind: 'section'
      emoji?: string
      title: string
      body: string[]
      list?: string[]
      anchor?: string
      pos?: { x: number; y: number }
      width?: number
    }

// Default modal width in px. Individual steps can override with `width`.
export const TOUR_WIDTH = 880

// ---- The intro pitch (first screen) -----------------------------------------
// Edit these paragraphs to change the opening welcome text. The greeting line
// ("Good luck, <name>...") is added automatically above these.
export const WELCOME_PITCH: string[] = [
  'Welcome to **The Tapestry**, the online home of **Distemper**, a post-apocalyptic comic book & tabletop roleplaying game.',
  'Set in the aftermath of H724, also known as *the dog flu* or *the distemper*, a pandemic that wiped out almost 90% of humanity in less than a year, players find themselves in what is left of this dangerous, brutal, and capricious new world where only the strong will survive.',
  'There are no zombies, mutants, or aliens, just other, desperate survivors. But, no matter how much has changed, one constant remains - the **biggest threat is always other people**.',
  'The Tapestry is a one-stop shop with tools for character creation, world building, creating and playing in stories, running campaigns, and finding your people in this broken new world.',
  'The next few screens give a quick tour of the interface. You can skip out any time and revisit this screen by clicking "A Guide to the Tapestry".',
]

// ---- The closing video screen -----------------------------------------------
// Edit the heading/subtitle, and swap the YouTube IDs + labels as needed.
export const VIDEO_HEADING = 'Watch to Learn More'
export const VIDEO_SUBTITLE = 'Short video guides to get you started. Click any tile to watch it on YouTube.'
export const TOUR_VIDEOS: TourVideo[] = [
  { id: '0L86NMSh7uw', label: 'Video 1' },
  { id: 'o6paVNSs8oY', label: 'Video 2' },
  { id: 'RopjejNJytg', label: 'Video 3' },
  { id: 'b5-ivxOnIQY', label: 'Video 4' },
  { id: 'GgofisDsDXM', label: 'Video 5' },
  { id: 'nbwy57Cdu8o', label: 'Video 6' },
]

// ---- The steps, in order ----------------------------------------------------
export const TOUR_STEPS: TourStep[] = [
  { kind: 'welcome' },

  {
    kind: 'section',
    title: 'The Dashboard',
    anchor: 'dashboard',
    pos: { x: 259, y: 221 },
    body: [
      '**The Dashboard** is where you will find links to help you navigate the world around you.',
      'From here you can create, start, or take part in a Story, view your Survivors, interact with the community around The Campfire, and consult the full rules or the quick reference guide.',
    ],
  },

  {
    kind: 'section',
    title: 'My Survivors',
    anchor: 'survivors',
    pos: { x: 259, y: 266 },
    body: [
      'Here you can access, inspect, and edit your roster of character sheets, as well as access character creation tools.',
      'There is a dedicated Survivors area below with more details and a guide to creating characters for Distemper.',
    ],
  },

  {
    kind: 'section',
    title: 'My Stories',
    anchor: 'stories',
    pos: { x: 259, y: 310 },
    body: [
      'Here is where you launch **The Table**, the Virtual Tabletop (or *VTT*) around which stories are told.', 
      'Whether it is as a player or GM, this is where you will find the various campaigns and one-shots you have created, are running, or are playing in, as well as the Story creation toolkit.',
    ],
  },

  {
    kind: 'section',
    title: 'My Communities',
    anchor: 'communities',
    pos: { x: 259, y: 399 },
    body: [
      '**Communities** are persistent groups of survivors who share a base and resources. Communities allow groups to grow across sessions and leave their indelible mark on this persistent world. NPCs can be recruited to your cause as cohorts, conscripts, or converts. ',
      'This is where you can see, inspect, and communicate with other members of the communities you belong to.',
    ],
  },

  {
    kind: 'section',
    title: 'The Campfire',
    anchor: 'campfire',
    pos: { x: 259, y: 300 },
    body: [
      '**The Campfire** is the post-apocalyptic equivalent of the town notice board and where survivors gather to share what they\'ve heard, warn others, and find people to travel with. Here you\'ll find:',
    ],
    list: [
      '**Settings Hubs**: The Tapestry includes two campaign settings - **District Zero** & **the Kings Crossroads Mall**, both of which have their own dedicated area',
      '**Direct Messages**: Communicate with other members of the community one-on-one or in group chats',
      '**Looking for Group**: Players seeking a game, GMs seeking players',
      '**Forums**: An area for long-form discussion and the exchange of ideas',
      '**Rumors from the map**: Pins surface here with extra detail',
      '**War Stories**: Session write-ups and fan fiction',
      '**World Events**: Updates from the publisher and the world itself',
      '**Timestamps**: Facilitate cross-timezone play with this tool that translates time into the local user\'s timezone.',
    ],
  },

  {
    kind: 'section',
    title: 'Rumors',
    anchor: 'rumors',
    pos: { x: 259, y: 410 },
    body: [
      'Here you can find pre-built scenes, encounters, adventures, and campaigns - collectively called **Stories** - that you can import to play with your own group.',
      'In addition to **Stories**, here you can find NPCs, items, locations, and plot hooks that you can use in your original Stories with your own group.',
      'Authors can snapshot their content and share with the community for other groups to use.',
    ],
  },

  {
    kind: 'section',
    title: 'Your Characters',
    anchor: 'characters',
    pos: { x: 259, y: 210 },
    body: [
      'Here you can create characters from the methods below.',
       '**Backstory Generation** allows you to spend *Character Development Points (CDP)* on attributes and skills during the different stages of your character\'s life. This life pathing system offers complete control to define what they learned and how they changed as they grew up, what they studied, their hobbies and passions, how they made their way before the apocalypse, and what they have learned since. [Recommended for new players].',
      '**The Quick Character Generator** lets you spend 20 CDP on customizing your character without going through the various steps.',
      '**The Random Character Generator** gives you everything you need to start playing immediately.',
      '**Paradigms** allows you to pick from familiar tropes where you just need to add a name to get started.',
      'Every character has a story before the story begins; here is where you write yours.',

    ],
  },

  {
    kind: 'section',
    title: 'World Events',
    anchor: 'world',
    pos: { x: 937, y: 76 },
    width: 640,
    body: [
      'The interactive map is the backbone of the living, breathing Tapestry. Players and GMs drop pins to mark locations, leave notes, and submit Rumors for others to substantiate.',
      'Here are various pins and waypoints that help define the **DistemperVerse**.',
      'There is a **Timeline of the Dog Flu** that shows how the virus spread and the destruction it wrought. Clicking on the pins in order will tell the story by taking you to various locations and offering insight into the events that transpired there.',
      '**Rumors** are the unsubstantiated stories that players may choose to investigate to see for themselves to see what is actually happening.',
      'Maybe you decided to blow up the Washington Monument or your group has moved into Graceland. The **Locations** tab is where groups can write the story of this dark new world and shape the history yet to come',
      'Pins for player-driven events that have been dropped on the map and submitted for curation may appear here for all other players to see, changing the world for everyone, forever.',
    ],
  },

  {
    kind: 'section',
    title: 'Your Pins',
    anchor: 'pins',
    pos: { x: 937, y: 76 },
    width: 640,
    body: [
      'Whether they are your own personal annotations or pins related to the **Stories** and **campaigns** you take part in, here is where you will find non-public pins',

    ],
  },

  {
    kind: 'section',
    title: 'Whispers',
    anchor: 'whispers',
    pos: { x: 937, y: 76 },
    width: 640,
    body: [
      'Connect with others who are currently online and trying to survive...',
    ],
  },

  { kind: 'video' },
]

// Anchor key -> CSS selector of the tagged element(s) in the app UI. An element
// can belong to several anchors (data-tour="a b"); ~= matches any one word.
export function tourAnchorSelector(anchor: string): string {
  return `[data-tour~="${anchor}"]`
}
