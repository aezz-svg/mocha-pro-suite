'use client'

import { cn } from '@/lib/utils'
import { useMocha } from './mocha-provider'

const LEVEL_TAG = { info: 'INFO', success: ' OK ', error: 'FAIL' } as const

export function EngineTerminal({ className, limit }: { className?: string; limit?: number }) {
  const { logs, busyOp } = useMocha()
  const visible = limit ? logs.slice(0, limit) : logs

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-black/70', className)}>
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2" dir="ltr">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-gold/80" />
        <span className="size-2.5 rounded-full bg-signal/80" />
        <span className="ms-2 font-mono text-[10px] text-white/40">mocha@sovereign: ~/engine</span>
      </div>
      <ol
        aria-live="polite"
        aria-label="مخرجات المحرك"
        className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
      >
        {visible.length === 0 && <li className="text-white/30" dir="ltr">بانتظار أوامر المعالجة المحلية</li>}
        {visible.map((entry) => (
          <li key={entry.id} className="flex gap-2">
            <span className="shrink-0 text-white/25" dir="ltr">
              {new Date(entry.time).toLocaleTimeString('en-GB')}
            </span>
            <span
              dir="ltr"
              className={cn(
                'shrink-0',
                entry.level === 'success' && 'text-signal',
                entry.level === 'error' && 'text-red-400',
                entry.level === 'info' && 'text-gold',
              )}
            >
              [{LEVEL_TAG[entry.level]}]
            </span>
            <span className="text-white/75">{entry.message}</span>
          </li>
        ))}
        <li className="flex items-center gap-1 text-white/40" dir="ltr" aria-hidden>
          <span className="text-signal">$</span>
          {busyOp ? <span className="text-gold">running {busyOp}…</span> : null}
          <span className="inline-block h-3 w-1.5 animate-pulse bg-white/60" />
        </li>
      </ol>
    </div>
  )
}

