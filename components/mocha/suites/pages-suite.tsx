'use client'

import { ArrowDownUp, LayoutGrid, Merge, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { parsePageRanges } from '@/lib/pdf-inspect'
import { cn } from '@/lib/utils'
import { useMocha } from '../mocha-provider'
import { ActionButton, Field, GlassPanel, SectionTitle, Segmented, TextInput } from '../primitives'

type MergeFile = { name: string; path: string }

export function PagesSuite() {
  const { info, file, run, log } = useMocha()
  const pageCount = info?.pages ?? 0
  const [selected, setSelected] = useState<number[]>([])
  const [rangeInput, setRangeInput] = useState('1-3, 5')
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
  const [rotatePreview, setRotatePreview] = useState<Record<number, number>>({})
  const [mergeFiles, setMergeFiles] = useState<MergeFile[]>([])
  const [dragMergePath, setDragMergePath] = useState<string | null>(null)
  useEffect(() => { if (file?.path) setMergeFiles([{path:file.path,name:file.name}]) }, [file?.path, file?.name])

  const parsedRange = useMemo(() => parsePageRanges(rangeInput, pageCount), [rangeInput, pageCount])
  const thumbs = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount])
  const docKey = `${info?.name ?? ''}:${pageCount}`
  const [orderState, setOrderState] = useState<{ key: string; order: number[] }>({ key: '', order: [] })
  const order = orderState.key === docKey ? orderState.order : thumbs
  const reordered = order.some((p, i) => p !== i + 1)
  const [dragPage, setDragPage] = useState<number | null>(null)
  const [overPage, setOverPage] = useState<number | null>(null)

  function setOrder(next: number[]) {
    setOrderState({ key: docKey, order: next })
  }

  function movePage(from: number, to: number) {
    if (from === to) return
    const next = order.filter((p) => p !== from)
    const targetIndex = next.indexOf(to)
    next.splice(order.indexOf(from) < order.indexOf(to) ? targetIndex + 1 : targetIndex, 0, from)
    setOrder(next)
  }

  function togglePage(page: number) {
    setSelected((prev) => (prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].sort((a, b) => a - b)))
  }

  async function applyPageOrder() {
    if (!file || !reordered) return
    const result = await run('reorder_pages', 'حفظ ترتيب الصفحات الجديد', { settings: { pageOrder: order } })
    if (result) {
      log('success', 'تم حفظ ترتيب الصفحات في ملف PDF جديد؛ ظل الملف الأصلي دون تغيير.')
      setOrder(thumbs)
    }
  }

  async function handleRotate() {
    const pages = selected.length > 0 ? selected : thumbs
    const result = await run('rotate', `تدوير الصفحات ${angle}°`, {
      settings: { 
        targetPages: pages.map(p => p - 1)
      },
    })
    if (!result) return
    setRotatePreview((prev) => {
      const next = { ...prev }
      pages.forEach((p) => (next[p] = ((next[p] ?? 0) + angle) % 360))
      return next
    })
  }

  async function handleOrganizePages() {
    if (selected.length === 0) {
      log('error', 'يرجى تحديد صفحة واحدة على الأقل من الشبكة لتنفيذ أمر التنظيم والحذف الفعلي.')
      return
    }
    await run('delete_pages', 'حذف الصفحات غير المحددة', {
      settings: {
        targetPages: selected.map(p => p - 1)
      }
    })
  }

  async function handleExtractRange() {
    if (parsedRange.length === 0) {
      log('error', 'النطاق المدخل غير صالح أو خارج نطاق أعداد صفحات المستند الفعلي.')
      return
    }
    await run('organize_pages', `استخراج النطاق الرقمي (${rangeInput})`, {
      settings: {
        targetPages: parsedRange.map(p => p - 1)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="p-5">
        <SectionTitle
          icon={LayoutGrid}
          title="معاينة الصفحات"
          subtitle={
            pageCount
              ? `${pageCount} صفحة · ${selected.length} محددة · اسحب الصفحة المحددة إلى الموضع المطلوب ثم احفظ الترتيب`
              : 'ارفع ملفاً لعرض شبكة الصفحات'
          }
          action={
            pageCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {reordered && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOrder(thumbs)}
                      className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:border-gold/50 hover:text-white"
                    >
                      استعادة الترتيب
                    </button>
                    <ActionButton op="reorder_pages" variant="ghost" icon={ArrowDownUp} disabled={!file || !reordered} onClick={applyPageOrder} title="ينشئ ملف PDF جديداً بترتيب الصفحات الحالي" className="h-7 border-gold/50 px-2.5 text-xs text-amber-200">حفظ الترتيب الجديد</ActionButton>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(thumbs)}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:border-neon/50 hover:text-white"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:border-neon/50 hover:text-white"
                >
                  إلغاء
                </button>
              </div>
            )
          }
        />
        {pageCount === 0 ? (
          <div className="mt-5 grid grid-cols-4 gap-3 opacity-30 sm:grid-cols-6 lg:grid-cols-10" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[1/1.414] rounded-md border border-dashed border-white/15" />
            ))}
          </div>
        ) : (
          <ul className="no-scrollbar mt-5 grid max-h-[420px] grid-cols-4 gap-3 overflow-y-auto p-1 sm:grid-cols-6 lg:grid-cols-10">
            {order.map((page, position) => {
              const isSelected = selected.includes(page)
              const inRange = parsedRange.includes(page)
              const rotation = rotatePreview[page] ?? 0
              return (
                <li
                  key={page}
                  draggable
                  onDragStart={(e) => {
                    setDragPage(page)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (overPage !== page) setOverPage(page)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragPage !== null) movePage(dragPage, page)
                    setDragPage(null)
                    setOverPage(null)
                  }}
                  onDragEnd={() => {
                    setDragPage(null)
                    setOverPage(null)
                  }}
                  className={cn(
                    'relative cursor-grab rounded-md transition-all active:cursor-grabbing',
                    dragPage === page && 'opacity-40',
                    overPage === page && dragPage !== page && 'ring-2 ring-gold ring-offset-2 ring-offset-black',
                  )}
                >
                  <span
                    className="pointer-events-none absolute -top-1.5 -start-1.5 z-10 rounded bg-black/80 px-1 font-mono text-[9px] text-gold"
                    aria-hidden
                  >
                    #{position + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePage(page)}
                    aria-pressed={isSelected}
                    aria-label={`الصفحة ${page}، الموضع ${position + 1}`}
                    style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
                    className={cn(
                      'group relative flex aspect-[1/1.414] w-full flex-col gap-1 rounded-md border bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-2 transition-all hover:border-white/20',
                      isSelected ? 'border-neon shadow-neon' : inRange ? 'border-gold/40 bg-gold/5' : 'border-white/10'
                    )}
                  >
                    <PageThumbnail path={file?.path} page={page} />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center font-mono text-[10px] text-white/70">P. {page}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={Scissors} title="حذف وتقطيع الصفحات" subtitle="استخراج أو إتلاف صفحات معينة" />
          <Field label="نطاق الصفحات المطلوب الاحتفاظ به" htmlFor="range">
            <TextInput id="range" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)} placeholder="مثال: 1-4, 7, 9-11" />
          </Field>
          <ActionButton op="extract" variant="signal" onClick={handleExtractRange}>
            استخراج النطاق
          </ActionButton>
          <ActionButton op="delete_pages" disabled title="حذف صفحات PDF غير مدعوم بعد" variant="ghost" onClick={handleOrganizePages}>
            حذف غير المحدد · غير متاح
          </ActionButton>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={LayoutGrid} title="تدوير الصفحات" subtitle="ضبط زاوية العرض" />
          <Segmented
            label="الزاوية"
            value={String(angle)}
            onChange={(v) => setAngle(Number(v) as any)}
            options={[
              { value: '90', label: '90°' },
              { value: '180', label: '180°' },
              { value: '270', label: '270°' },
            ]}
          />
          <ActionButton op="rotate" disabled title="تدوير PDF غير مدعوم بعد" variant="signal" onClick={handleRotate} className="mt-auto">
            تدوير الصفحات النشطة
          </ActionButton>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={Merge} title="دمج الملفات" subtitle="إضافة مستندات أخرى للدمج" />
          <button
            type="button"
            onClick={async () => {
              const selected = await open({ multiple: true, directory: false, title: 'اختر ملفات PDF للدمج', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
              const paths = Array.isArray(selected) ? selected : typeof selected === 'string' ? [selected] : []
              const allPaths = file && !paths.includes(file.path) ? [file.path, ...paths] : paths
              setMergeFiles(allPaths.map(path => ({ path, name: path.split(/[\\/]/).pop() || path })))
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/5 p-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            اختيار ملفات PDF محلياً ({mergeFiles.length})
          </button>
          {mergeFiles.length > 0 && <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-white/65" aria-label="ترتيب ملفات الدمج">{mergeFiles.map((file,index) => <li key={file.path} draggable onDragStart={event=>{setDragMergePath(file.path);event.dataTransfer.effectAllowed='move'}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!dragMergePath||dragMergePath===file.path)return;setMergeFiles(previous=>{const next=[...previous];const from=next.findIndex(item=>item.path===dragMergePath);const to=next.findIndex(item=>item.path===file.path);const [moved]=next.splice(from,1);next.splice(to,0,moved);return next});setDragMergePath(null)}} onDragEnd={()=>setDragMergePath(null)} className="cursor-grab truncate rounded border border-white/10 p-2 active:cursor-grabbing" dir="ltr" title="اسحب لإعادة ترتيب ملفات الدمج">{index+1}. {file.name}</li>)}</ul>}
          <ActionButton 
            op="merge" 
            variant="signal" 
            icon={Merge} 
            className="mt-auto" 
            onClick={() => run('merge_files', 'دمج ملفات PDF محلياً', { settings: { secondaryFilePaths: mergeFiles.map(file => file.path) } })}
          >
            تنفيذ الدمج الكامل
          </ActionButton>
        </GlassPanel>
      </div>
    </div>
  )
}

function PageThumbnail({ path, page }: { path?: string; page: number }) {
  const [source, setSource] = useState('')
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!path || !element) return
    let active = true
    let objectUrl = ''
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      void invoke<number[]>('render_pdf_page_thumbnail', { inputPath: path, page }).then(bytes => {
        if (!active) return
        const png = new Uint8Array(bytes)
        objectUrl = URL.createObjectURL(new Blob([png.buffer as ArrayBuffer], { type: 'image/png' }))
        setSource(objectUrl)
      }).catch(() => { /* keep the numbered placeholder if Ghostscript cannot render */ })
    }, { rootMargin: '120px' })
    observer.observe(element)
    return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [element, page, path])
  return <div ref={setElement} className="absolute inset-0 overflow-hidden rounded-md bg-white/[0.04]">{source ? <img src={source} alt={`معاينة الصفحة ${page}`} className="size-full object-contain"/> : <span className="grid size-full place-items-center font-mono text-xs text-white/30">PDF</span>}</div>
}









