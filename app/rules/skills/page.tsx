import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Skills — XSE SRD §05' }

export default function Page() {
  return <SectionHub section={findSection('skills')!} />
}
