// Renders Discord-style HammerTime timestamp tokens (<t:UNIX> and
// <t:UNIX:FORMAT>) in user-typed message bodies. Outside Discord these
// tokens render literally as text — this turns them into formatted dates.
//
// Format chars (matching Discord/HammerTime):
//   t  short time         9:01 PM
//   T  long time          9:01:00 PM
//   d  short date         4/27/2026
//   D  long date          April 27, 2026
//   f  short date+time    April 27, 2026 at 9:01 PM    (default)
//   F  long date+time     Monday, April 27, 2026 at 9:01 PM
//   R  relative           in 2 hours / 3 days ago
//
// Optional `linkify: true` also auto-links http(s) URLs in the same pass,
// for surfaces (DMs) that previously used a standalone linkifier.

import React from 'react'

const TOKEN_RE = /<t:(-?\d+)(?::([tTdDfFR]))?>|(https?:\/\/[^\s<>]+)/g

type FormatChar = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R'

function formatAbsolute(date: Date, fmt: FormatChar): string {
  switch (fmt) {
    case 't': return date.toLocaleTimeString(undefined, { timeStyle: 'short' } as Intl.DateTimeFormatOptions)
    case 'T': return date.toLocaleTimeString(undefined, { timeStyle: 'medium' } as Intl.DateTimeFormatOptions)
    case 'd': return date.toLocaleDateString(undefined, { dateStyle: 'short' } as Intl.DateTimeFormatOptions)
    case 'D': return date.toLocaleDateString(undefined, { dateStyle: 'long' } as Intl.DateTimeFormatOptions)
    case 'F': return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' } as Intl.DateTimeFormatOptions)
    case 'f':
    case 'R':
    default:
      return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' } as Intl.DateTimeFormatOptions)
  }
}

function formatRelative(date: Date, now: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const diffSec = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60)            return rtf.format(diffSec, 'second')
  if (abs < 3600)          return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400)         return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 604800)        return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 2629800)       return rtf.format(Math.round(diffSec / 604800), 'week')
  if (abs < 31557600)      return rtf.format(Math.round(diffSec / 2629800), 'month')
  return rtf.format(Math.round(diffSec / 31557600), 'year')
}

function HammerTimeChip({ unix, fmt }: { unix: number; fmt: FormatChar }) {
  const date = new Date(unix * 1000)
  if (Number.isNaN(date.getTime())) return <>{`<t:${unix}${fmt === 'f' ? '' : ':' + fmt}>`}</>
  const absolute = formatAbsolute(date, fmt === 'R' ? 'F' : fmt)
  const display = fmt === 'R' ? formatRelative(date, Date.now()) : absolute
  return (
    <time
      dateTime={date.toISOString()}
      title={absolute}
      style={{
        display: 'inline-block',
        padding: '0 4px',
        borderRadius: 3,
        background: 'rgba(122, 179, 212, 0.15)',
        color: '#cce0f5',
        fontSize: 'inherit',
        cursor: 'help',
      }}
    >
      {display}
    </time>
  )
}

export function renderRichText(
  body: string | null | undefined,
  options: { linkify?: boolean } = {}
): React.ReactNode[] {
  if (!body) return []
  const out: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(body)) !== null) {
    if (m.index > lastIndex) out.push(body.slice(lastIndex, m.index))
    const [matched, unixStr, fmtStr, urlStr] = m
    if (unixStr !== undefined) {
      const unix = Number(unixStr)
      const fmt = (fmtStr || 'f') as FormatChar
      out.push(<HammerTimeChip key={`t${key++}`} unix={unix} fmt={fmt} />)
    } else if (urlStr !== undefined) {
      if (options.linkify) {
        out.push(
          <a
            key={`l${key++}`}
            href={urlStr}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#7ab3d4', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {urlStr}
          </a>
        )
      } else {
        out.push(urlStr)
      }
    }
    lastIndex = m.index + matched.length
  }
  if (lastIndex < body.length) out.push(body.slice(lastIndex))
  return out
}
