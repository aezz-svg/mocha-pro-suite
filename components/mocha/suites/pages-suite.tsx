'use client'

import { ArrowDownUp, LayoutGrid, Merge, Scissors } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { parsePageRanges } from '@/lib/pdf-inspect'
import { cn } from '@/lib/utils'
import { useMocha } from '../mocha-provider'
import { ActionButton, Field, GlassPanel, SectionTitle, Segmented, TextInput } from '../primitives'

const MAX_THUMBS = 120

export function PagesSuite() {
  const { info, run, log } = useMocha()
  const pageCount = info?.pages ?? 0
  const [selected, setSelected] = useState<number[]>([])
  const [rangeInput, setRangeInput] = useState('1-3, 5')
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
  const [rotatePreview, setRotatePreview] = useState<Record<number, number>>({})
  const [mergeFiles, setMergeFiles] = useState<File[]>([])
  const mergeInputRef = useRef<HTMLInputElement>(null)

  const parsedRange = useMemo(() => parsePageRanges(rangeInput, pageCount), [rangeInput, pageCount])
  const thumbs = useMemo(() => Array.from({ length: Math.min(pageCount, MAX_THUMBS) }, (_, i) => i + 1), [pageCount])
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

  function moveMerge(index: number, dir: -1 | 1) {
    setMergeFiles((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleRotate() {
    const pages = selected.length > 0 ? selected : thumbs
    await run('rotate', `تدوير الصفحات ${angle}°`, {
      settings: { 
        targetPages: pages.map(p => p - 1)
      },
    })
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
    await run('organize_pages', 'تنظيم وحذف الصفحات غير المحددة', {
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
              ? `${pageCount} صفحة · ${selected.length} محددة · اسحب الصفحات لإعادة ترتيبها${pageCount > MAX_THUMBS ? ` · عرض أول ${MAX_THUMBS}` : ''}`
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
                    <ActionButton
                      op="reorder"
                      variant="ghost"
                      icon={ArrowDownUp}
                      className="h-7 border-gold/50 px-2.5 text-xs text-amber-200"
                      disabled={pageCount > MAX_THUMBS}
                      onClick={() => run('organize_pages', 'تطبيق إعادة ترتيب الصفحات الفعلي', { settings: { targetPages: order.map(p => p - 1) } })}
                    >
                      تطبيق الترتيب
                    </ActionButton>
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
                    <div className="m-auto font-mono text-xs text-white/40 group-hover:text-white/70">
                      P. {page}
                    </div>
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
          <ActionButton op="organize" variant="ghost" onClick={handleOrganizePages}>
            حذف غير المحدد
          </ActionButton>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={LayoutGrid} title="تدوير الصفحات" subtitle="ضبط زاوية العرض" />
          <Segmented
            label="الزاوية"
            value={angle}
            onChange={(v) => setAngle(Number(v) as any)}
            options={[
              { value: '90', label: '90°' },
              { value: '180', label: '180°' },
              { value: '270', label: '270°' },
            ]}
          />
          <ActionButton op="rotate" variant="signal" onClick={handleRotate} className="mt-auto">
            تدوير الصفحات النشطة
          </ActionButton>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={Merge} title="دمج الملفات" subtitle="إضافة مستندات أخرى للدمج" />
          <input 
            type="file" 
            accept=".pdf" 
            ref={mergeInputRef} 
            className="hidden" 
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setMergeFiles(prev => [...prev, f])
            }} 
          />
          <button 
            type="button" 
            onClick={() => mergeInputRef.current?.click()} 
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/5 p-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            إضافة مستند مدمج
          </button>

          {mergeFiles.length > 0 && (
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
              {mergeFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white/5 px-2.5 py-1.5 text-xs text-white">
                  <span className="truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveMerge(i, -1)} className="p-0.5 hover:text-gold">↑</button>
                    <button type="button" onClick={() => moveMerge(i, 1)} className="p-0.5 hover:text-gold">↓</button>
                    <button type="button" onClick={() => setMergeFiles(p => p.filter((_, idx) => idx !== i))} className="p-0.5 text-red-400 hover:text-red-500">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ActionButton 
            op="merge" 
            variant="signal" 
            icon={Merge} 
            className="mt-auto" 
            onClick={() => run('merge_files', 'دمج الملفات السحابية', { settings: { secondaryFileId: 'GOOGLE_DRIVE_SECONDARY_FILE_ID' } })}
          >
            تنفيذ الدمج الكامل
          </ActionButton>
        </GlassPanel>
      </div>
    </div>
  )
}