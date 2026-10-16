'use client'

import { useEffect, useRef } from 'react'

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: 'gold' | 'neon' }

const MAX_PARTICLES = 90

export function AmbientFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const particles: Particle[] = []
    let frame = 0
    let running = false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function tick() {
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy -= 0.015
        p.life -= 0.018
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        const color = p.hue === 'gold' ? '217, 119, 6' : '99, 102, 241'
        const radius = 1.4 + p.life * 2.2
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4)
        gradient.addColorStop(0, `rgba(${color}, ${0.75 * p.life})`)
        gradient.addColorStop(1, `rgba(${color}, 0)`)
        ctx!.fillStyle = gradient
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, radius * 4, 0, Math.PI * 2)
        ctx!.fill()
      }
      if (particles.length > 0) {
        frame = requestAnimationFrame(tick)
      } else {
        running = false
      }
    }

    function onMove(e: PointerEvent) {
      glowRef.current?.style.setProperty('transform', `translate3d(${e.clientX - 260}px, ${e.clientY - 260}px, 0)`)
      if (particles.length < MAX_PARTICLES) {
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.6,
          life: 1,
          hue: Math.random() > 0.35 ? 'gold' : 'neon',
        })
      }
      if (!running) {
        running = true
        frame = requestAnimationFrame(tick)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div
        ref={glowRef}
        className="absolute top-0 left-0 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(217_119_6/0.08)_0%,rgb(99_102_241/0.05)_35%,transparent_70%)] will-change-transform"
        style={{ transform: 'translate3d(-600px,-600px,0)' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 size-full mix-blend-screen" />
    </div>
  )
}
