'use client'
import { useMocha } from './mocha-provider'
export function MochaGlobalStatus() {
  const { busyOp, uploadProgress, timeRemaining, lastRun } = useMocha()
  if (!busyOp && !(lastRun && uploadProgress === 100)) return null
  const done = !busyOp && Boolean(lastRun) && uploadProgress === 100
  return <div role="status" aria-live="polite" className="fixed bottom-4 end-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur">
    <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{busyOp ? `جارٍ تنفيذ ${busyOp} محلياً` : 'اكتملت العملية'}</span><span className="font-mono text-signal">{done ? '100%' : 'جارٍ التنفيذ'}</span></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-gradient-to-r from-neon to-signal transition-all ${busyOp ? 'w-1/3 animate-pulse' : 'w-full'}`} /></div>
    <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs text-white/50"><span>{timeRemaining}</span>{lastRun && <span dir="ltr">{lastRun.durationMs}ms</span>}</div>
  </div>
}

