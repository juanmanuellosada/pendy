/** Genera un sonido de completado placentero usando Web Audio API (arpegio ascendente) */
export function playCompletionSound() {
  try {
    const ctx = new AudioContext()

    const notes = [
      { freq: 523.25, start: 0, duration: 0.12 }, // C5
      { freq: 659.25, start: 0.1, duration: 0.12 }, // E5
      { freq: 783.99, start: 0.2, duration: 0.22 }, // G5
    ]

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)

      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)

      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    })

    setTimeout(() => ctx.close(), 800)
  } catch {
    // Silenciar si el navegador no soporta Web Audio API
  }
}

/** Genera un sonido suave de descompletar (nota descendente corta) */
export function playUncompleteSound() {
  try {
    const ctx = new AudioContext()

    const notes = [
      { freq: 587.33, start: 0, duration: 0.1 }, // D5
      { freq: 440.0, start: 0.08, duration: 0.15 }, // A4
    ]

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)

      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)

      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    })

    setTimeout(() => ctx.close(), 500)
  } catch {
    // Silenciar si el navegador no soporta Web Audio API
  }
}
