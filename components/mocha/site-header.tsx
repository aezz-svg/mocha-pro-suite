'use client'

import { Hexagon, Server, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { pingEngine } from '@/lib/mocha-api'
import { cn } from '@/lib/utils'
import { useMocha } from './mocha-provider'

type EngineState = { status: 'idle' | 'checking' | 'online' | 'offline'; latency?: number }

export function SiteHeader() {
  const { endpoint, setEndpoint, log } = useMocha()
  const [engine, setEngine] = useState<EngineState>({ status: 'idle' })

  async function checkEngine() {
    setEngine({ status: 'checking' })
    try {
      const latency = await pingEngine()
      setEngine({ status: 'online', latency: typeof latency === 'number' ? latency : 12 })
      log('success', `المحرك المحلي متصل`)
    } catch {
      setEngine({ status: 'offline' })
      log('error', 'المحرك المحلي غير متاح.')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Mocha Pro">
            <span className="relative flex size-9 items-center justify-center rounded-lg bg-neon/15 text-neon shadow-neon">
              <Hexagon className="size-5" aria-hidden />
            </span>
            <span className="font-mono text-base font-bold tracking-tight text-white" dir="ltr">
              MOCHA<span className="text-neon">.PRO</span>
            </span>
          </a>
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <span className="rounded-md border border-neon/30 bg-neon/10 px-2.5 py-1 font-mono text-xs font-semibold text-neon">
            الدفعة 37 Architectural
          </span>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label htmlFor="endpoint" className="sr-only">
            عنوان المحرك المحلي
          </label>
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 sm:w-80 sm:flex-none">
            <Server className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="endpoint"
              dir="ltr"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white/80 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            onClick={checkEngine}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
              engine.status === 'online'
                ? 'border-signal/40 bg-signal/10 text-signal'
                : engine.status === 'offline'
                  ? 'border-destructive/40 bg-destructive/10 text-red-300'
                  : 'border-white/10 bg-white/[0.03] text-white/80 hover:border-neon/50',
            )}
          >
            {engine.status === 'offline' ? (
              <WifiOff className="size-3.5" aria-hidden />
            ) : (
              <Wifi className={cn('size-3.5', engine.status === 'checking' && 'animate-pulse')} aria-hidden />
            )}
            <span>
              {engine.status === 'online'
                ? `متصل`
                : engine.status === 'offline'
                  ? 'غير متصل'
                  : engine.status === 'checking'
                    ? 'جارٍ الفحص…'
                    : 'فحص المحرك'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}