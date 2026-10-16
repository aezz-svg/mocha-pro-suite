'use client'

import { formatBytes } from '@/lib/pdf-inspect'
import { useMocha } from './mocha-provider'

export function StatusTicker() {
  const { file, info, vault, lastRun, busyOp, endpoint, logs } = useMocha()
  const latest = logs[0]

  const items = [
    `ENGINE ${busyOp ? `BUSY · ${busyOp.toUpperCase()}` : 'STANDBY'}`,
    `UPLINK ${endpoint.replace(/^https?:\/\//, '')}`,
    file ? `DOC ${file.name} · ${formatBytes(file.size)} · ${info?.pages ?? 0} PP` : 'DOC — AWAITING INPUT',
    `VAULT ${vault.length} ASSETS`,
    lastRun ? `LAST ${lastRun.operation.toUpperCase()} · ${lastRun.durationMs} MS` : 'LAST — NO RUNS YET',
    'CIPHER AES-256 READY',
    'TELEMETRY LOCAL-ONLY · ZERO CLOUD',
    latest ? `LOG ${latest.level.toUpperCase()}` : 'LOG CLEAN',
  ]

  return (
    <div
      role="status"
      aria-label="شريط الحالة المباشر"
      className="relative overflow-hidden border-y border-gold/20 bg-black/60 py-2 backdrop-blur-xl [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
      dir="ltr"
    >
      <div className="flex w-max animate-ticker gap-10 whitespace-nowrap font-mono text-[11px] tracking-widest">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-white/60" aria-hidden={i >= items.length}>
            <span className={i % 3 === 0 ? 'size-1.5 rounded-full bg-signal shadow-signal' : 'size-1.5 rounded-full bg-gold'} />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
