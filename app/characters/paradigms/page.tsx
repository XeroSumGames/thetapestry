'use client'
// /characters/paradigms — the third character-creation funnel.
//
// Backstory wizard = full 7-step authored character. Random = one click,
// here's a Survivor. This page is the in-between: the player browses the
// 12 Paradigms (real-world archetypes the SRD ships with), picks one as
// a starting template, and lands on the Final Review step of the
// existing edit wizard with that Paradigm's RAPID + skills pre-seeded.
//
// Pick → routes to /characters/random?paradigm=<name>. The random page
// (which already drops users at /characters/[id]/edit?step=4 — Final
// Review) honors the ?paradigm= param and seeds with that specific
// Paradigm instead of a random pick. From Final Review the player can
// freely tweak RAPID + skills within the standard creation caps before
// hitting Finalize.

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ParadigmPicker from '../../../components/ParadigmPicker'
import type { Paradigm } from '../../../lib/xse-schema'

export default function ParadigmsPage() {
  const router = useRouter()

  function handlePick(p: Paradigm) {
    // Encode in case future Paradigm names contain spaces or special
    // characters; the random page does a case-insensitive lookup.
    router.push(`/characters/random?paradigm=${encodeURIComponent(p.name)}`)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ marginBottom: '6px', fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#c4a7f0', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        Survivors
      </div>
      <h1 style={{ margin: 0, fontFamily: 'Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
        Paradigms
      </h1>

      <div style={{ marginTop: '12px', marginBottom: '20px', fontSize: '14px', color: '#cce0f5', lineHeight: 1.6, maxWidth: '780px' }}>
        <p style={{ margin: '0 0 10px' }}>
          A Paradigm is an archetype — a real-world role the SRD ships with as a complete RAPID + skill loadout.
          Pick one and you skip the seven-step Backstory wizard; the system rolls a Motivation, Complication, and concept
          for you, and seeds the character with the Paradigm&apos;s baseline.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          You&apos;ll land on the <strong style={{ color: '#7ab3d4' }}>Final Review</strong> page where the RAPID Range Attributes
          and Skills are already set. From there you can rebalance freely — within the standard creation caps
          (no attribute or skill above <strong style={{ color: '#7fc458' }}>+3</strong> at character creation). When you click <strong>Finalize</strong>,
          any last-minute changes carry over to your live character sheet.
        </p>
        <p style={{ margin: 0, color: '#5a5550', fontSize: '13px' }}>
          Paradigms are templates, not cages — a Rural Sheriff who wants to dump points into Medicine and Inspiration
          can. The archetype is just where the journey starts.
        </p>
      </div>

      <div style={{ marginBottom: '12px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        Pick a Paradigm
      </div>

      {/* ParadigmPicker is the same reusable component used by the
          Apprentice creation wizard. The "Pick" button on each card
          fires onChange — we route to the Random generator with the
          chosen Paradigm name. value=null because no card is "already
          picked" on this entry surface. */}
      <ParadigmPicker value={null} onChange={handlePick} />

      <div style={{ marginTop: '24px', fontSize: '13px', color: '#5a5550' }}>
        Want to author every detail yourself? Try{' '}
        <Link href="/characters/new" style={{ color: '#c4a7f0', textDecoration: 'underline' }}>Backstory Generation</Link>.
        Just want a Survivor right now? Hit{' '}
        <Link href="/characters/random" style={{ color: '#c4a7f0', textDecoration: 'underline' }}>Random Character</Link>.
      </div>
    </div>
  )
}
