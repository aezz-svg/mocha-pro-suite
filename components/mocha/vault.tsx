'use client'

import { Archive, Download, FileText, Trash2 } from 'lucide-react'
import { triggerDownload } from '@/lib/mocha-api'
import { formatBytes } from '@/lib/pdf-inspect'
import { useMocha } from './mocha-provider'
import { GlassPanel, SectionTitle } from './primitives'

export function Vault() {
  const { vault, removeFromVault, clearVault } = useMocha()

  return (
    <GlassPanel id="vault" className="p-5 sm:p-6">
      <SectionTitle
        icon={Archive}
        title="خزانة الملفات · Vault"
        subtitle={`${vault.length} ملف معالج في هذه الجلسة — محفوظ في الذاكرة فقط`}
        action={
          vault.length > 0 && (
            <button
              type="button"
              onClick={clearVault}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-destructive/50 hover:text-red-300"
            >
              <Trash2 className="size-3.5" aria-hidden />
              إفراغ الخزانة
            </button>
          )
        }
      />

      {vault.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/30 py-12 text-center">
          <Archive className="size-8 text-white/15" aria-hidden />
          <p className="mt-3 text-sm text-white/60">الخزانة فارغة</p>
          <p className="mt-1 text-xs text-muted-foreground">ستظهر هنا جميع الملفات الناتجة من المحرك فور اكتمال المعالجة.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vault.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/40 p-3 transition-colors hover:border-neon/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
                <FileText className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-semibold text-white" dir="ltr" title={entry.filename}>
                  {entry.filename}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {entry.label} · {formatBytes(entry.size)} · {entry.durationMs}ms
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => triggerDownload(entry.url, entry.filename)}
                  aria-label={`تنزيل ${entry.filename}`}
                  className="flex size-8 items-center justify-center rounded-md bg-neon/15 text-neon hover:bg-neon hover:text-white"
                >
                  <Download className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromVault(entry.id)}
                  aria-label={`حذف ${entry.filename}`}
                  className="flex size-8 items-center justify-center rounded-md text-white/40 hover:bg-destructive/15 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
