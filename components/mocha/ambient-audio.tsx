'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type AudioRig = { ctx: AudioContext; master: GainNode }

function buildRig(): AudioRig {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const seconds = 4
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 520
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.55
  noise.connect(lowpass).connect(noiseGain).connect(master)
  noise.start()

  for (const [freq, level] of [
    [55, 0.05],
    [82.4, 0.03],
    [110.2, 0.015],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07 + Math.random() * 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = level * 0.6
    const gain = ctx.createGain()
    gain.gain.value = level
    lfo.connect(lfoGain).connect(gain.gain)
    osc.connect(gain).connect(master)
    osc.start()
    lfo.start()
  }

  return { ctx, master }
}

export function AmbientAudioToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false)
  const rigRef = useRef<AudioRig | null>(null)

  useEffect(() => () => void rigRef.current?.ctx.close(), [])

  async function toggle() {
    const rig = (rigRef.current ??= buildRig())
    const now = rig.ctx.currentTime
    if (rig.ctx.state === 'suspended') await rig.ctx.resume()
    rig.master.gain.cancelScheduledValues(now)
    rig.master.gain.setTargetAtTime(on ? 0 : 0.35, now, 0.6)
    setOn(!on)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all backdrop-blur-xl',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        on ? 'border-gold/60 bg-gold/15 text-amber-200 shadow-gold' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-gold/50',
        className,
      )}
    >
      {on ? <Volume2 className="size-3.5" aria-hidden /> : <VolumeX className="size-3.5" aria-hidden />}
      <span>{on ? 'الأجواء الصوتية مفعّلة' : 'تفعيل الأجواء الصوتية'}</span>
      {on && (
        <span className="flex items-end gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-0.5 animate-pulse rounded-full bg-gold" style={{ height: 6 + i * 3, animationDelay: `${i * 0.2}s` }} />
          ))}
        </span>
      )}
    </button>
  )
}
