'use client'

import { ArrowDown, ArrowDownUp, ArrowUp, Files, LayoutGrid, Merge, Plus, RotateCw, Scissors, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { formatBytes, pagesToRanges, parsePageRanges } from '@/lib/pdf-inspect'
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

  function nudge(page: number, dir: -1 | 1) {
    const idx = order.indexOf(page)
    const target = idx + dir
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[idx], next[target]] = [next[target], next[idx]]
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
    const result = await run('rotate', `تدوير الصفحات ${angle}°`, {
      params: { angle, pages: selected.length > 0 ? pagesToRanges(selected) : 'all' },
    })
    if (result) {
      setRotatePreview((prev) => {
        const next = { ...prev }
        pages.forEach((p) => (next[p] = ((next[p] ?? 0) + angle) % 360))
        return next
      })
    }
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
                      onClick={() => run('reorder', 'إعادة ترتيب الصفحات', { params: { order } })}
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
                    onKeyDown={(e) => {
                      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                        e.preventDefault()
                        nudge(page, e.key === 'ArrowRight' ? -1 : 1)
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-label={`الصفحة ${page}، الموضع ${position + 1}. اسحب لإعادة الترتيب أو استخدم Alt مع الأسهم`}
                    className={cn(
                      'group relative flex aspect-[1/1.414] w-full flex-col gap-1 rounded-md border bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-2 transition-all',
                      isSelected
                        ? 'border-neon shadow-neon'
                        : inRange
                          ? 'border-signal/60'
                          : 'border-white/10 hover:border-gold/50',
                    )}
                    style={{ transform: `rotate(${rotatePreview[page] ?? 0}deg)` }}
                  >
                    <span className="h-1 w-3/4 rounded-full bg-white/25" />
                    <span className="h-0.5 w-full rounded-full bg-white/10" />
                    <span className="h-0.5 w-5/6 rounded-full bg-white/10" />
                    <span className="h-0.5 w-full rounded-full bg-white/10" />
                    <span className="mt-1 h-4 w-full rounded-sm bg-white/[0.05]" />
                    <span className="h-0.5 w-2/3 rounded-full bg-white/10" />
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-1 text-center font-mono text-[10px]',
                        isSelected ? 'text-neon' : inRange ? 'text-signal' : 'text-white/40',
                      )}
                    >
                      {page}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={Scissors} title="تجزئة PDF" subtitle="استخراج نطاق من الصفحات" />
          <Field label="نطاق الصفحات" htmlFor="split-range" hint="مثال: 1-3, 5, 8-10 — الصفحات المطابقة تتوهج بالأخضر.">
            <TextInput id="split-range" dir="ltr" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)} />
          </Field>
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {parsedRange.length} pages → [{parsedRange.slice(0, 12).join(', ')}
            {parsedRange.length > 12 ? '…' : ''}]
          </p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setRangeInput(pagesToRanges(selected))}
              className="self-start text-xs text-neon underline-offset-4 hover:underline"
            >
              استخدام الصفحات المحددة ({pagesToRanges(selected)})
            </button>
          )}
          <ActionButton
            op="split"
            icon={Scissors}
            className="mt-auto"
            onClick={() => {
              if (parsedRange.length === 0) return log('error', 'نطاق الصفحات غير صالح.')
              run('split', 'تجزئة النطاق', { params: { ranges: rangeInput, pages: parsedRange } })
            }}
          >
            تجزئة النطاق
          </ActionButton>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={Merge} title="دمج الملفات" subtitle="المستند النشط + الملفات أدناه بالترتيب" />
          <input
            ref={mergeInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
              setMergeFiles((prev) => [...prev, ...picked])
              e.target.value = ''
            }}
          />
          <ul className="no-scrollbar flex max-h-44 min-h-24 flex-col gap-2 overflow-y-auto">
            {mergeFiles.length === 0 && (
              <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 py-6 text-xs text-muted-foreground">
                لم تتم إضافة ملفات بعد
              </li>
            )}
            {mergeFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/40 p-2">
                <span className="font-mono text-[10px] text-neon">{String(i + 2).padStart(2, '0')}</span>
                <Files className="size-3.5 shrink-0 text-white/40" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white" dir="ltr">
                  {f.name}
                </span>
                <span className="hidden text-[10px] text-white/40 sm:inline">{formatBytes(f.size)}</span>
                <button type="button" aria-label="تحريك للأعلى" onClick={() => moveMerge(i, -1)} className="text-white/40 hover:text-white">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" aria-label="تحريك للأسفل" onClick={() => moveMerge(i, 1)} className="text-white/40 hover:text-white">
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`إزالة ${f.name}`}
                  onClick={() => setMergeFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-white/40 hover:text-red-300"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <ActionButton variant="ghost" icon={Plus} onClick={() => mergeInputRef.current?.click()}>
              إضافة ملفات
            </ActionButton>
            <ActionButton
              op="merge"
              icon={Merge}
              onClick={() => {
                if (mergeFiles.length === 0) return log('error', 'أضف ملفاً واحداً على الأقل للدمج.')
                run('merge', 'دمج الملفات', {
                  extraFiles: mergeFiles,
                  params: { order: mergeFiles.map((f) => f.name) },
                })
              }}
            >
              دمج الآن
            </ActionButton>
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <SectionTitle icon={RotateCw} title="تدوير الصفحات" subtitle="يطبّق على المحدد أو جميع الصفحات" />
          <Field label="زاوية التدوير">
            <Segmented
              label="زاوية التدوير"
              value={angle}
              onChange={setAngle}
              options={[
                { value: 90, label: '90°' },
                { value: 180, label: '180°' },
                { value: 270, label: '270°' },
              ]}
            />
          </Field>
          <div className="flex items-center justify-center py-2" aria-hidden>
            <div
              className="flex aspect-[1/1.414] w-14 items-start justify-center rounded border border-neon/60 bg-neon/10 pt-2 transition-transform duration-500"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <ArrowUp className="size-4 text-neon" />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            الهدف: {selected.length > 0 ? `${selected.length} صفحة محددة` : 'جميع الصفحات'}
          </p>
          <ActionButton op="rotate" icon={RotateCw} className="mt-auto" onClick={handleRotate}>
            تدوير الصفحات
          </ActionButton>
        </GlassPanel>
      </div>
    </div>
  )
}
