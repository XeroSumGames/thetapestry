import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

// /rules/communities — hub page. Renders the section's anchors as cards
// linking to per-anchor sub-pages. Source: tasks/rules-extract-communities.md
// (canonical, with errata applied to the SRD §08 PDF).

export const metadata = { title: 'Communities — XSE SRD §08' }

export default function CommunitiesHubPage() {
  return <SectionHub section={findSection('communities')!} />
}
