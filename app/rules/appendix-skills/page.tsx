import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Appendix B — Skills — XSE SRD' }

export default function Page() {
  return <SectionHub section={findSection('appendix-skills')!} />
}
