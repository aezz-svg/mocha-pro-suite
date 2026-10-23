'use client'

import { FileText, FileUp, X } from 'lucide-react'
import { formatBytes } from '@/lib/pdf-inspect'
import { useMocha } from './mocha-provider'
import { GlassPanel } from './primitives'

export function UploadZone() {
  const { file, inspecting, openFilePicker, clearFile } = useMocha()
  return <GlassPanel className="p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-gold/10 text-gold"><FileUp className="size-5" /></span><div><h2 className="font-semibold text-white">ملف PDF محلي</h2><p className="text-xs text-muted-foreground">تتم القراءة والمعالجة على هذا الجهاز</p></div></div>
      <div className="flex gap-2"><button type="button" disabled={inspecting} onClick={() => void openFilePicker()} className="rounded-lg bg-neon px-4 py-2 text-sm text-white disabled:opacity-50">{inspecting ? 'جارٍ الفحص…' : 'اختيار ملف PDF'}</button>{file && <button type="button" onClick={clearFile} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 text-sm text-white/70"><X size={14}/>إزالة</button>}</div>
    </div>
    {file ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4"><FileText className="text-signal"/><div className="min-w-0"><p className="truncate font-mono text-sm text-white" dir="ltr">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.path}</p></div></div> : <button type="button" disabled={inspecting} onClick={() => void openFilePicker()} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-white/60 hover:border-neon/50">اختر مستند PDF من جهازك</button>}
  </GlassPanel>
}
