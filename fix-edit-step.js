const fs = require('fs');

const filePath = 'C:/TheTapestry/app/characters/[id]/edit/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add useSearchParams to the next/navigation import
content = content.replace(
  "import { useRouter, useParams } from 'next/navigation'",
  "import { useRouter, useParams, useSearchParams } from 'next/navigation'"
);

// Add useSearchParams hook and use it for initial step
content = content.replace(
  "  const [state, setState] = useState<WizardState | null>(null)",
  "  const searchParams = useSearchParams()\n  const initialStep = parseInt(searchParams.get('step') ?? '0', 10)\n  const [state, setState] = useState<WizardState | null>(null)"
);

// Use initialStep instead of hardcoded 0
content = content.replace(
  "  const [step, setStep] = useState(0)",
  "  const [step, setStep] = useState(initialStep)"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('done');
