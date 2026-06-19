## Snapshot Delete - Test Plan

1. Go to the table for any campaign that has snapshots.
2. Open GM Tools > Reload (the "Restore from Snapshot" modal).
3. Confirm each snapshot card now shows a "Delete" button in the top-right corner.
4. Click Delete on one snapshot. A browser confirm dialog should appear: "Delete snapshot <name>? This cannot be undone."
5. Click Cancel in the confirm dialog - snapshot should remain in the list, nothing changes.
6. Click Delete again, then OK in the confirm dialog - the snapshot should disappear from the list immediately.
7. Close and reopen the modal - the deleted snapshot should not reappear.
8. Confirm the Reload button still works on a remaining snapshot.

Report back what you saw.
