const fs = require('fs');

const filePath = 'C:/TheTapestry/components/MapView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCategories = content.match(/const PIN_CATEGORIES = \[[\s\S]*?\]/)[0];

const newCategories = `const PIN_CATEGORIES = [
  { value: 'location',   label: 'Location / POI',     emoji: '\uD83D\uDCCD' },
  { value: 'residence',  label: 'Residence',           emoji: '\uD83C\uDFE0' },
  { value: 'business',   label: 'Business / Shop',     emoji: '\uD83C\uDFAA' },
  { value: 'church',     label: 'Church',              emoji: '\u26EA' },
  { value: 'government', label: 'Government',          emoji: '\uD83C\uDFDB\uFE0F' },
  { value: 'airport',    label: 'Airport / Transport', emoji: '\u2708\uFE0F' },
  { value: 'hospital',   label: 'Hospital / Medical',  emoji: '\uD83C\uDFE5' },
  { value: 'military',   label: 'Military / Outpost',  emoji: '\u2694\uFE0F' },
  { value: 'person',     label: 'Person / NPC',        emoji: '\uD83D\uDC64' },
  { value: 'danger',     label: 'Danger / Threat',     emoji: '\u2620\uFE0F' },
  { value: 'resource',   label: 'Resource / Supply',   emoji: '\uD83C\uDF92' },
  { value: 'rumor',      label: 'Rumor / Unverified',  emoji: '\u2753' },
  { value: 'medical',    label: 'Medical',             emoji: '\uD83D\uDEA8' },
]`;

content = content.replace(oldCategories, newCategories);

// Also fix the fallback emoji in getCategoryEmoji
content = content.replace(
  /return PIN_CATEGORIES\.find\(c => c\.value === category\)\?\.emoji \?\? '.*?'/,
  "return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '\uD83D\uDCCD'"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('done');
