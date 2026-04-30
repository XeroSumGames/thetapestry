'use client'
import Link from 'next/link'

interface Props {
  show: boolean
  onClose: () => void
  message?: string
}

export default function GhostWall({ show, onClose, message }: Props) {
  if (!show) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #c0392b', borderRadius: '4px', padding: '2rem', width: '380px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Ghost — You Don't Exist</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Become a Survivor</div>
        <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {message || "You are a ghost — you don't exist if you don't sign up."}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <Link href="/signup" style={{ display: 'block', padding: '10px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>
            Create Account
          </Link>
          <Link href="/login" style={{ display: 'block', padding: '10px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>
            Sign In
          </Link>
          <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', color: '#666', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Go Back to Stalking
          </button>
        </div>
      </div>
    </div>
  )
}
