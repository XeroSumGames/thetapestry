const fs = require('fs');

const filePath = 'C:/TheTapestry/components/MapView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace medical emoji with a styled HTML string marker
content = content.replace(
  "{ value: 'medical',    label: 'Medical',             emoji: '\u2795' }",
  "{ value: 'medical',    label: 'Medical',             emoji: '<span style=\"color:#e74c3c;font-weight:900;font-size:20px;line-height:1;\">+</span>' }"
);

// Update the divIcon html to use innerHTML safely — it already uses template literal so this works
// But we need to handle the case where emoji might be an HTML string
// The divIcon html already renders emoji directly in innerHTML so this will work as-is

fs.writeFileSync(filePath, content, 'utf8');
console.log('done');
