// /v2/rules - THE RULES in the house frame.
//
// Phase 1.3: the section opens INSIDE the frame instead of leaving it. A thin
// SERVER component on purpose - it just hands the existing page component to
// the shared client shell as the centre. That is what lets app/rules/page.tsx
// (a server component) and the four client sections both work here without
// either being rewritten: a server component cannot be imported INTO a client
// component, but it can be passed into one as a prop.
//
// The page below is today's, unchanged. Only the frame around it is new.
import V2Shell from '../../../components/V2Shell'
import RulesIndexPage from '../../rules/page'

export default function V2RulesIndexPage() {
  return <V2Shell active="rules" centre={<RulesIndexPage />} />
}
