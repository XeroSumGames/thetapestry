import { redirect } from 'next/navigation'

// /v2 is the frame's front door; the Dashboard is what it opens onto, matching
// the old app where / and /dashboard both land on the map.
//
// Both paths are in the guest-visible list (lib/auth/public-pages.ts), so this
// redirect does not bounce a logged-out visitor into a login round-trip.
export default function V2IndexPage() {
  redirect('/v2/dashboard')
}
