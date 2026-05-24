'use client'
import { useGlobalPresenceTracker } from '../lib/realtime/useGlobalPresence'

// Always-mountable global presence tracker. The "Survivors present" count
// (rendered in Sidebar) reads the `global_presence` channel, but Sidebar
// unmounts on full-width routes - the tactical table, vehicle, popouts - so
// anyone sitting at a table dropped out of the count. LayoutShell renders
// this on its sidebar-less branch so every authenticated full-width route
// keeps tracking the user. The raw channel lives in the lib/realtime seam.
// Renders nothing; tracking only.
export default function GlobalPresence() {
  useGlobalPresenceTracker()
  return null
}
