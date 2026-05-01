import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Appendix C — Weapons & Equipment — XSE SRD' }

export default function Page() {
  return <SectionHub section={findSection('appendix-equipment')!} />
}
