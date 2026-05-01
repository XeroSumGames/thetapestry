import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Weapons & Equipment — XSE SRD §07' }

export default function Page() {
  return <SectionHub section={findSection('equipment')!} />
}
