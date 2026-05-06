import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'

// /welcome/guide/[chapter] — renders one Beginners' Guide chapter.
// Server component: reads docs/beginners-guide-NN.txt at request
// time, renders the body inside a <pre>-styled column. The .txt
// files use === underline rules + section headers; rendering
// preserves linebreaks so the formatting reads on the web the
// same way it does in the source. Adding a Markdown pass would be
// nicer typography but requires content rewrites in the .txt
// files first; ship plain text for now.
//
// Allowed chapters: 01 through 12 (zero-padded). Any other slug
// 404s via notFound().

const CHAPTERS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
] as const

const CHAPTER_TITLES: Record<string, string> = {
  '01': 'Navigating the Site',
  '02': 'Pins, Notifications, and Roles',
  '03': 'The World Map',
  '04': 'Creating a Character',
  '05': 'Creating a Story',
  '06': 'The Table and Sessions',
  '07': 'The Tactical Map',
  '08': 'Combat',
  '09': 'Creating a Community',
  '10': 'NPCs and Recruitment',
  '11': 'The Campfire',
  '12': 'Rumors',
}

interface PageProps {
  params: Promise<{ chapter: string }>
}

export async function generateStaticParams() {
  return CHAPTERS.map(c => ({ chapter: c }))
}

export async function generateMetadata({ params }: PageProps) {
  const { chapter } = await params
  const title = CHAPTER_TITLES[chapter]
  return {
    title: title ? `${chapter} · ${title} — Beginners' Guide` : 'Beginners\' Guide',
  }
}

export default async function ChapterPage({ params }: PageProps) {
  const { chapter } = await params
  if (!CHAPTERS.includes(chapter as any)) notFound()

  // Read the chapter file from docs/. process.cwd() is the repo root
  // in both `next dev` and the Vercel build / runtime environments.
  // If the file is missing (forgot to commit a draft), bail to 404
  // instead of crashing the page.
  let body = ''
  try {
    body = fs.readFileSync(
      path.join(process.cwd(), 'docs', `beginners-guide-${chapter}.txt`),
      'utf-8',
    )
  } catch {
    notFound()
  }

  const idx = CHAPTERS.indexOf(chapter as any)
  const prev = idx > 0 ? CHAPTERS[idx - 1] : null
  const next = idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '2rem 1rem', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <Link href="/welcome/guide" style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', textDecoration: 'none' }}>
          ← Beginners' Guide
        </Link>

        <h1 style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          <span style={{ color: '#EF9F27', marginRight: '12px' }}>{chapter}</span>
          {CHAPTER_TITLES[chapter]}
        </h1>

        {/* Chapter body — plain text rendered with line breaks
            preserved. The source files lay out their own ASCII
            structure (=== rules, ---- separators, indentation),
            so we just present them as a monospaced column. */}
        <pre style={{
          fontFamily: '"Cascadia Mono", Consolas, monospace',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#cce0f5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#141414',
          border: '1px solid #2e2e2e',
          borderRadius: '4px',
          padding: '16px 18px',
        }}>{body}</pre>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          {prev ? (
            <Link href={`/welcome/guide/${prev}`} style={{ fontSize: '14px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: 'none' }}>
              ← {prev}. {CHAPTER_TITLES[prev]}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/welcome/guide/${next}`} style={{ fontSize: '14px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', textDecoration: 'none', textAlign: 'right' }}>
              {next}. {CHAPTER_TITLES[next]} →
            </Link>
          ) : <span />}
        </div>
      </div>
    </div>
  )
}
