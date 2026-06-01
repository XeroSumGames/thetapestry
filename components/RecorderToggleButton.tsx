'use client'
// Chrome-level ⏺ recorder toggle for the Sidebar user-header icon row.
// Scoped by userId (not campaignId) so it survives navigation across all
// routes. Phase A: single-tab only; the /table cascade button handles the
// multi-client broadcast case. See tasks/finding-recorder-chrome-button-2026-05-31.md.

import { useEffect, useState } from 'react'
import {
  downloadDump,
  wipeBuffer,
  setEnabled as recorderSetEnabled,
  getRecorder,
  readUserEnabled,
  writeUserEnabled,
} from '../lib/playtest-recorder'

interface Props {
  userId: string
}

export default function RecorderToggleButton({ userId }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (readUserEnabled(userId)) {
      recorderSetEnabled(true)
      setEnabled(true)
    } else {
      const r = getRecorder()
      if (r) setEnabled(!!r.enabled)
    }
  }, [userId])

  async function toggle() {
    if (toggling) return
    setToggling(true)
    const next = !enabled
    if (next) {
      wipeBuffer()
      recorderSetEnabled(true)
      writeUserEnabled(userId, true)
    } else {
      downloadDump()
      recorderSetEnabled(false)
      writeUserEnabled(userId, false)
    }
    setEnabled(next)
    setToggling(false)
  }

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Stop recording (downloads JSON)' : 'Start recording'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
        fontSize: '16px', fontFamily: 'Carlito, sans-serif', lineHeight: 1,
        color: enabled ? '#c0392b' : '#d4cfc9',
        opacity: enabled ? 1 : 0.65,
      }}
    >
      ⏺
    </button>
  )
}
