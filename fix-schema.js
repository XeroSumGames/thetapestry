const fs = require('fs');

let c = fs.readFileSync('C:/TheTapestry/lib/xse-schema.ts', 'utf8');

// Add to XSECharacter interface - find the unique string near notes in XSECharacter
c = c.replace(
  '  complication: string;\n  motivation: string;\n  notes: string;',
  '  complication: string;\n  motivation: string;\n  notes: string;\n  age: string;\n  physdesc: string;\n  photoDataUrl: string;'
);

// Add to createBlankCharacter
c = c.replace(
  "    motivation: '',\n    notes: '',\n    creationMethod: 'backstory',",
  "    motivation: '',\n    notes: '',\n    age: '',\n    physdesc: '',\n    photoDataUrl: '',\n    creationMethod: 'backstory',"
);

fs.writeFileSync('C:/TheTapestry/lib/xse-schema.ts', c, 'utf8');

// Verify
const updated = fs.readFileSync('C:/TheTapestry/lib/xse-schema.ts', 'utf8');
console.log('photoDataUrl in interface:', updated.includes("  photoDataUrl: string;"));
console.log('photoDataUrl in blank char:', updated.includes("    photoDataUrl: '',"));