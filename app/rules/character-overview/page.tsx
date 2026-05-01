import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Character Overview — XSE SRD §03' }

export default function Page() {
  return <SectionHub section={findSection('character-overview')!} />
}
