'use client'

export function StatusTicker() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-black/40 px-3 py-1 text-xs text-white/60">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-neon"></span>
      </span>
      <span className="font-mono text-[10px]" dir="ltr">MOCHA ENGINE v3.0: ONLINE</span>
    </div>
  )
}
