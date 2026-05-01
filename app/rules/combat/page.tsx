import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Combat — XSE SRD §06' }

export default function Page() {
  return <SectionHub section={findSection('combat')!} />
}
