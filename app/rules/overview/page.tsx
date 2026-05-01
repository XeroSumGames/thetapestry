import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Overview — XSE SRD §01' }

export default function Page() {
  return <SectionHub section={findSection('overview')!} />
}
