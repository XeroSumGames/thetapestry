// tactical-view.ts
// Pure decisions for the table's map view (tactical vs campaign).
//
// The invariant (locked by Xero 2026-05-22): "sharing" the tactical map drives
// what PLAYERS see, NOT the GM's own pane. The GM can preview the Campaign map
// while players still see the shared tactical scene. Before this, the GM's
// local view (showTacticalMap) was entangled with the shared flag
// (tacticalShared) on every client, so a GM who shared was pinned to tactical.
//
// "gmLike" = the GM or a Thriver co-GM (the same dividing line the view toggle
// uses); everyone else is a player who follows the shared view.

export function shouldFollowSharedTactical(gmLike: boolean): boolean {
  // Players follow the GM's shared tactical view; the GM's own pane is never
  // force-switched by share / scene-activation events - they toggle freely.
  return !gmLike
}

export function shouldRenderTactical(args: {
  combatActive: boolean
  showTacticalMap: boolean
  tacticalShared: boolean
  gmLike: boolean
}): boolean {
  const { combatActive, showTacticalMap, tacticalShared, gmLike } = args
  // Combat forces tactical for everyone. Otherwise this client's own toggle
  // decides. The shared flag pins ONLY non-GM clients - the GM can preview the
  // campaign map while players see the shared tactical scene.
  return combatActive || showTacticalMap || (tacticalShared && !gmLike)
}
