import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Core Mechanics — XSE SRD §02' }

export default function Page() {
  return <SectionHub section={findSection('core-mechanics')!} />
}
