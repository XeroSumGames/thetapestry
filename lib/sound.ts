// Tiny Web Audio chirps for in-table notifications. No audio assets to ship -
// a short two-note sine "ping" is synthesized on the fly. One lazily-created,
// reused AudioContext (browsers cap how many you can make). Fully guarded:
// SSR-safe, and any failure (no Web Audio, autoplay still blocked) is swallowed
// so a missing ping never breaks the table.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = ctx ?? new Ctor()
    // After a user gesture the context resumes; a notification mid-session
    // (the user has already interacted) is allowed to play.
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Soft two-note "ping" for an incoming chat message (A5 -> E6). */
export function playChatPing() {
  const ac = getCtx()
  if (!ac) return
  try {
    const now = ac.currentTime
    const blip = (freq: number, startOffset: number, dur: number, peak = 0.14) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t0 = now + startOffset
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t0)
      osc.stop(t0 + dur + 0.02)
    }
    blip(880, 0, 0.13)
    blip(1318.5, 0.1, 0.17)
  } catch {
    // no-op - a failed ping must never throw into the render/event path
  }
}
