'use client'
import { useState } from 'react'

export interface NoteAttachment {
  name: string
  url: string
  size: number
  type: string
  path: string
}

interface Props {
  attachments: NoteAttachment[]
  onDelete?: (att: NoteAttachment) => void
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImage(att: NoteAttachment): boolean {
  return att.type.startsWith('image/')
}

export default function NoteAttachmentsView({ attachments, onDelete }: Props) {
  const [lightbox, setLightbox] = useState<NoteAttachment | null>(null)

  if (attachments.length === 0) return null

  const images = attachments.filter(isImage)
  const files = attachments.filter(a => !isImage(a))

  return (
    <>
      {/* Image attachments — large inline previews */}
      {images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: files.length > 0 ? '8px' : 0 }}>
          {images.map(att => (
            <div key={att.path} style={{ position: 'relative', background: '#0d0d0d', border: '1px solid #2e2e2e', borderRadius: '3px', overflow: 'hidden' }}>
              <img
                src={att.url}
                alt={att.name}
                onClick={() => setLightbox(att)}
                style={{ display: 'block', width: '100%', maxHeight: '600px', objectFit: 'contain', cursor: 'zoom-in', background: '#000' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderTop: '1px solid #2e2e2e', background: '#1a1a1a' }}>
                <span style={{ flex: 1, fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name} <span style={{ color: '#5a5550' }}>({fmtSize(att.size)})</span>
                </span>
                <a href={att.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: '12px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', padding: '2px 6px', border: '1px solid #2e2e5a', borderRadius: '2px' }}>
                  Open
                </a>
                {onDelete && (
                  <button onClick={() => onDelete(att)}
                    style={{ background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#c0392b', fontSize: '12px', padding: '0 6px', cursor: 'pointer' }}>×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Non-image attachments — compact chips */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {files.map(att => (
            <div key={att.path} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              <a href={att.url} target="_blank" rel="noreferrer"
                style={{ flex: 1, fontSize: '12px', color: '#7ab3d4', fontFamily: 'Barlow, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                📄 {att.name} <span style={{ color: '#5a5550' }}>({fmtSize(att.size)})</span>
              </a>
              {onDelete && (
                <button onClick={() => onDelete(att)}
                  style={{ background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#c0392b', fontSize: '12px', padding: '0 6px', cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox — click image to view full-size */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem' }}
        >
          <img
            src={lightbox.url}
            alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'default' }}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 14px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}
    </>
  )
}
