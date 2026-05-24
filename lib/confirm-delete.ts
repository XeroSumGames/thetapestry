// Type-to-confirm gate for irreversible deletions (campaign / story delete).
// Uses native prompt()/alert() to match the codebase's existing confirm()-based
// destructive-action dialogs - no new modal component, no schema. The user must
// type the exact name (trimmed) before the deletion proceeds, which stops a
// stray click on the Delete button from wiping a whole campaign.
//
// Returns true only on an exact (trimmed) name match. An optional `warning` is
// shown above the type-to-confirm line (e.g. the published-module caveat).
export function confirmDeleteByName(name: string | null | undefined, warning?: string): boolean {
  if (typeof window === 'undefined') return false
  const safeName = (name ?? '').trim() || 'this story'
  const prefix = warning ? `${warning}\n\n` : ''
  const typed = window.prompt(`${prefix}This permanently deletes "${safeName}" and cannot be undone.\n\nType the story name exactly to confirm:`)
  if (typed === null) return false // cancelled
  if (typed.trim() !== safeName) {
    alert(`That does not match "${safeName}". Deletion cancelled.`)
    return false
  }
  return true
}
