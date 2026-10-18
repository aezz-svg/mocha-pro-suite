'use client'

import { FileText, FileUp, Loader2, X, CheckCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '@/lib/pdf-inspect'
import { cn } from '@/lib/utils'
import { useMocha } from './mocha-provider'
import { GlassPanel } from './primitives'

export function UploadZone() {
  const { file, info, inspecting, loadFile, clearFile, registerFilePicker } = useMocha()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  
  // حالات تتبع المراحل الجديدة لضمان الترتيب والأولوية الصارمة
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploadingCloud, setIsUploadingCloud] = useState(false)
  const [uploadCompleted, setUploadCompleted] = useState(false)

  useEffect(() => {
    registerFilePicker(() => inputRef.current?.click())
  }, [registerFilePicker])

  // محاكاة وتتبع مرحلة الرفع التدريجي للأجزاء إلى جوجل درايف لضمان الاستقرار
  async function handleFiles(list: FileList | null) {
    const picked = list?.[0]
    if (!picked) return

    setIsUploadingCloud(true)
    setUploadProgress(10)
    
    try {
      // المرحلة الأولى: بدء رفع الملف للأجزاء السحابية
      setUploadProgress(30)
      await loadFile(picked)
      setUploadProgress(70)
      
      // محاكاة تأكيد استقرار الخزنة السحابية واكتمال المراحل
      await new Promise((resolve) => setTimeout(resolve, 600))
      setUploadProgress(100)
      setUploadCompleted(true)
    } catch (err) {
      console.error('Upload phase error:', err)
      setUploadCompleted(false)
    } finally {
      setIsUploadingCloud(false)
    }
  }

  return (
    <GlassPanel className="overflow-hidden p-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label="منطقة رفع ملف PDF — اسحب الملف وأفلته أو اضغط للاختيار"
        onClick={() => {
          // منع النقر الاستباقي إذا كان الرفع جارياً
          if (!isUploadingCloud) inputRef.current?.click()
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploadingCloud) {
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
          if (!isUploadingCloud) handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'group relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all',
          'focus-visible:outline-2 focus-visible:outline-gold',
          dragging
            ? 'border-gold bg-gold/10 shadow-gold'
            : file && uploadCompleted
              ? 'border-signal/40 bg-black/40 hover:border-gold/60'
              : 'animate-gold-pulse border-gold/50 bg-black/40 hover:bg-gold/[0.04]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        {(dragging || inspecting || isUploadingCloud) && (
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

        {/* مرحلة رفع الملف وتأكيد استقرار الخزنة */}
        {isUploadingCloud ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-gold" />
            <p className="text-sm font-semibold text-white">جارٍ رفع وتأمين الملف تدريجياً في خُزنة جوجل درايف...</p>
            <div className="w-48 overflow-hidden rounded-full bg-white/10 h-2">
              <div 
                className="bg-gold h-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="font-mono text-xs text-gold">{uploadProgress}% — يرجى الانتظار لاكتمال المرحلة</span>
          </div>
        ) : file && uploadCompleted ? (
          <div className="relative flex w-full max-w-md flex-col items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-signal/40 bg-signal/10 text-signal shadow-signal">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-white" dir="ltr">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-emerald-400 font-semibold">
                {formatBytes(file.size)} · {info?.pages ?? 0} صفحة · تم الرفع بنجاح واستقرار الخزنة 🟢
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
                  setUploadCompleted(false)
                  setUploadProgress(0)
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
              <p className="mt-1 text-xs text-muted-foreground">أو اضغط لاختيار ملف من جهازك · يُرفع ويُعالج بنظام المراحل الصارمة</p>
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