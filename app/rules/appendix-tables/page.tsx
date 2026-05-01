import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Appendix A — Tables — XSE SRD' }

export default function Page() {
  return <SectionHub section={findSection('appendix-tables')!} />
}
