import SectionHub from '../../../components/rules/SectionHub'
import { findSection } from '../../../lib/rules/sections'

export const metadata = { title: 'Character Creation — XSE SRD §04' }

export default function Page() {
  return <SectionHub section={findSection('character-creation')!} />
}
