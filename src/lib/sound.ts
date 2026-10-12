const SOUND_KEY = 'cat_diary_sound_enabled'

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_KEY)
  if (stored === 'false') return false
  return true
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false')
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!audioCtx) {
    audioCtx = new AudioCtx()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Play a cute, gentle synthesized cat "meow" sound (~250ms).
 * Frequency curves from ~780Hz up to 880Hz then down to 620Hz with soft envelope.
 */
export function playMeowSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(780, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08)
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.25)

    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.26)
  } catch {
    // AudioContext blocked or unsupported - fail gracefully
  }
}
