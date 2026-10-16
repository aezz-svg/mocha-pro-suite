'use client'

import { FileText, FileUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '@/lib/pdf-inspect'
import { cn } from '@/lib/utils'
import { useMocha } from './mocha-provider'
import { GlassPanel } from './primitives'

export function UploadZone() {
  const { file, info, inspecting, loadFile, clearFile, registerFilePicker } = useMocha()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    registerFilePicker(() => inputRef.current?.click())
  }, [registerFilePicker])

  function handleFiles(list: FileList | null) {
    const picked = list?.[0]
    if (picked) loadFile(picked)
  }

  return (
    <GlassPanel className="overflow-hidden p-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label="منطقة رفع ملف PDF — اسحب الملف وأفلته أو اضغط للاختيار"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'group relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all',
          'focus-visible:outline-2 focus-visible:outline-gold',
          dragging
            ? 'border-gold bg-gold/10 shadow-gold'
            : file
              ? 'border-signal/40 bg-black/40 hover:border-gold/60'
              : 'animate-gold-pulse border-gold/50 bg-black/40 hover:bg-gold/[0.04]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        {(dragging || inspecting) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 animate-scan bg-gradient-to-b from-transparent via-gold/25 to-transparent" />
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {file ? (
          <div className="relative flex w-full max-w-md flex-col items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-signal/40 bg-signal/10 text-signal shadow-signal">
              <FileText className="size-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-white" dir="ltr">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(file.size)} · {inspecting ? 'جارٍ الفحص البنيوي…' : `${info?.pages ?? 0} صفحة`} · جاهز للمعالجة
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
                اضغط لاستبدال الملف
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-red-300 hover:bg-destructive/20"
              >
                <X className="size-3" aria-hidden />
                إزالة
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-gold/50 bg-gold/10 text-gold shadow-gold transition-transform group-hover:-translate-y-1">
              <FileUp className="size-7" aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold text-white">اسحب ملف PDF وأفلته هنا</p>
              <p className="mt-1 text-xs text-muted-foreground">أو اضغط لاختيار ملف من جهازك · يُعالج محلياً بالكامل</p>
            </div>
            <span className="font-mono text-[10px] tracking-widest text-white/30" dir="ltr">
              ACCEPT: APPLICATION/PDF
            </span>
          </div>
        )}
      </div>
    </GlassPanel>
  )
}
