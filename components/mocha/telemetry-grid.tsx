'use client'

import { Activity, FileText, Gauge, HardDrive, Radar, Terminal } from 'lucide-react'
import { formatBytes } from '@/lib/pdf-inspect'
import { cn } from '@/lib/utils'
import { EngineTerminal } from './engine-terminal'
import { useMocha } from './mocha-provider'
import { GlassPanel, TiltCard } from './primitives'

function TelemetryCard({
  icon: Icon,
  label,
  code,
  children,
}: {
  icon: typeof FileText
  label: string
  code: string
  children: React.ReactNode
}) {
  return (
    <TiltCard className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between [transform:translateZ(20px)]">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5 text-gold" aria-hidden />
          {label}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/30" dir="ltr">
          <span className="size-1.5 animate-pulse rounded-full bg-signal shadow-signal" />
          {code}
        </span>
      </div>
      <div className="flex flex-col gap-3 [transform:translateZ(30px)]">{children}</div>
    </TiltCard>
  )
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-white/60">{label}</span>
      <span className={cn('font-mono', on ? 'text-signal' : 'text-white/30')}>{on ? 'YES' : 'NO'}</span>
    </li>
  )
}

export function TelemetryGrid() {
  const { file, info, lastRun } = useMocha()
  const throughput = lastRun && lastRun.durationMs > 0 ? lastRun.bytesIn / 1024 / 1024 / (lastRun.durationMs / 1000) : null
  const ratio = lastRun && lastRun.bytesOut > 0 ? ((1 - lastRun.bytesOut / lastRun.bytesIn) * 100).toFixed(1) : null

  return (
    <section aria-label="القياسات الحية" className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        <TelemetryCard icon={FileText} label="اسم الملف" code="T-01">
          <p className="truncate font-mono text-sm font-semibold text-white" dir="ltr" title={file?.name}>
            {file?.name ?? '— no file loaded —'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {info ? `PDF ${info.version} · ${info.producer ?? 'منتج غير معروف'}` : 'بانتظار رفع المستند'}
          </p>
        </TelemetryCard>

        <TelemetryCard icon={HardDrive} label="الحجم والصفحات" code="T-02">
          <div className="flex items-end gap-4" dir="ltr">
            <p className="font-mono text-2xl font-bold text-white">{file ? formatBytes(file.size) : '0 B'}</p>
            <p className="pb-1 font-mono text-sm text-neon">{info?.pages ?? 0} pp</p>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-l from-neon to-signal transition-all duration-700"
              style={{ width: file ? `${Math.min(100, (file.size / (50 * 1024 * 1024)) * 100 + 4)}%` : '0%' }}
            />
          </div>
        </TelemetryCard>

        <TelemetryCard icon={Radar} label="الأشعة البنيوية · X-Ray" code="T-03">
          {info ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['OBJ', info.objects],
                  ['IMG', info.images],
                  ['FONT', info.fonts],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-white/[0.06] bg-black/40 py-1.5">
                    <p className="font-mono text-sm font-semibold text-white">{v}</p>
                    <p className="font-mono text-[9px] text-white/40">{k}</p>
                  </div>
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Flag on={info.encrypted} label="مشفّر" />
                <Flag on={info.hasForms} label="نماذج" />
                <Flag on={info.hasJavaScript} label="JavaScript" />
                <Flag on={info.linearized} label="مُحسَّن للويب" />
              </ul>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">لا توجد بيانات بنيوية بعد.</p>
          )}
        </TelemetryCard>

        <TelemetryCard icon={Gauge} label="سرعة المعالجة" code="T-04">
          <div className="flex items-end gap-2">
            <p className="font-mono text-2xl font-bold text-signal">{lastRun ? `${lastRun.durationMs}` : '—'}</p>
            <p className="pb-1 font-mono text-xs text-white/50">ms</p>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {throughput ? `${throughput.toFixed(2)} MB/s` : 'idle'}
            {ratio ? ` · Δ ${ratio}%` : ''}
            {lastRun ? ` · ${lastRun.operation}` : ''}
          </p>
        </TelemetryCard>
      </div>

      <GlassPanel className="flex h-[340px] flex-col p-4 lg:h-auto">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="size-3.5 text-gold" aria-hidden />
            سجل المحرك
          </span>
          <Activity className="size-3.5 animate-pulse text-signal" aria-hidden />
        </div>
        <EngineTerminal className="flex-1" />
      </GlassPanel>
    </section>
  )
}