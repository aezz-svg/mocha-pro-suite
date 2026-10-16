'use client'

import { Brush, Highlighter, PenLine, Square, StickyNote, Strikethrough, Trash2, Underline } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useMocha } from '../mocha-provider'
import { ActionButton, Field, GlassPanel, SectionTitle, TextInput } from '../primitives'

type Tool = 'highlight' | 'underline' | 'strikeout' | 'note' | 'rectangle' | 'stamp'

type Annotation = {
  id: string
  type: Tool
  page: number
  x: number
  y: number
  color: string
  text?: string
}

const TOOLS: { id: Tool; label: string; icon: typeof Highlighter }[] = [
  { id: 'highlight', label: 'تظليل', icon: Highlighter },
  { id: 'underline', label: 'تسطير', icon: Underline },
  { id: 'strikeout', label: 'شطب', icon: Strikethrough },
  { id: 'note', label: 'ملاحظة لاصقة', icon: StickyNote },
  { id: 'rectangle', label: 'إطار', icon: Square },
  { id: 'stamp', label: 'ختم', icon: PenLine },
]

const COLORS = ['#FACC15', '#10B981', '#6366F1', '#F43F5E', '#38BDF8']

export function ReviewSuite() {
  const { run, info, log } = useMocha()
  const [tool, setTool] = useState<Tool>('highlight')
  const [color, setColor] = useState(COLORS[0])
  const [page, setPage] = useState(1)
  const [noteText, setNoteText] = useState('')
  const [author, setAuthor] = useState('Mocha Reviewer')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const maxPage = Math.max(1, info?.pages ?? 1)

  function placeAnnotation(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Number(((e.clientX - rect.left) / rect.width).toFixed(4))
    const y = Number(((e.clientY - rect.top) / rect.height).toFixed(4))
    setAnnotations((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        type: tool,
        page,
        x,
        y,
        color,
        text: tool === 'note' ? noteText || 'ملاحظة' : tool === 'stamp' ? 'APPROVED' : undefined,
      },
    ])
  }

  const pageAnnotations = annotations.filter((a) => a.page === page)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <GlassPanel className="flex flex-col gap-4 p-5 lg:col-span-2">
        <SectionTitle icon={Brush} title="أدوات المراجعة والترميز" subtitle="اختر أداة ثم اضغط على الصفحة لوضعها" />
        <div role="radiogroup" aria-label="أداة الترميز" className="grid grid-cols-3 gap-2">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tool === id}
              onClick={() => setTool(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-[11px] transition-all',
                tool === id ? 'border-neon bg-neon/15 text-white shadow-neon' : 'border-white/10 bg-black/40 text-white/60 hover:text-white',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <Field label="اللون">
          <div role="radiogroup" aria-label="لون الترميز" className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn('size-8 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-white' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        {tool === 'note' && (
          <Field label="نص الملاحظة اللاصقة" htmlFor="note-text">
            <TextInput id="note-text" placeholder="اكتب ملاحظتك…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="الصفحة" htmlFor="markup-page">
            <TextInput
              id="markup-page"
              type="number"
              min={1}
              max={maxPage}
              value={page}
              onChange={(e) => setPage(Math.min(maxPage, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
          <Field label="المؤلف" htmlFor="markup-author">
            <TextInput id="markup-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <ActionButton variant="ghost" icon={Trash2} onClick={() => setAnnotations([])} disabled={annotations.length === 0}>
            مسح الكل
          </ActionButton>
          <ActionButton
            op="annotate"
            icon={Highlighter}
            onClick={() => {
              if (annotations.length === 0) return log('error', 'أضف ترميزاً واحداً على الأقل.')
              run('annotate', `تطبيق ${annotations.length} ترميز`, {
                params: { author, annotations: annotations.map(({ id: _id, ...a }) => a) },
              })
            }}
          >
            تطبيق الترميزات
          </ActionButton>
        </div>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-3 p-5 lg:col-span-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/70">
            لوحة الصفحة <span className="font-mono text-neon">{page}</span> / {maxPage}
          </span>
          <span className="font-mono text-white/40">{annotations.length} annotations</span>
        </div>
        <div className="flex justify-center rounded-xl border border-white/[0.06] bg-black/50 p-4">
          <div
            role="application"
            aria-label="لوحة الترميز — اضغط لإضافة الأداة المحددة"
            onClick={placeAnnotation}
            className="relative aspect-[1/1.414] w-full max-w-sm cursor-crosshair overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-white/10"
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col gap-2.5 p-6" aria-hidden>
              <span className="h-2.5 w-2/3 rounded bg-white/20" />
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="h-1 rounded bg-white/[0.08]" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
              ))}
            </div>
            {pageAnnotations.map((a) => (
              <AnnotationMark key={a.id} annotation={a} />
            ))}
          </div>
        </div>
        {annotations.length > 0 && (
          <ul className="no-scrollbar flex max-h-32 flex-col gap-1.5 overflow-y-auto">
            {annotations.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-white/80">{TOOLS.find((t) => t.id === a.type)?.label}</span>
                <span className="font-mono text-white/40" dir="ltr">
                  p{a.page} · ({Math.round(a.x * 100)}%, {Math.round(a.y * 100)}%)
                </span>
                {a.text && <span className="truncate text-white/60">— {a.text}</span>}
                <button
                  type="button"
                  aria-label="حذف"
                  onClick={() => setAnnotations((prev) => prev.filter((x) => x.id !== a.id))}
                  className="ms-auto text-white/40 hover:text-red-300"
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  )
}

function AnnotationMark({ annotation: a }: { annotation: Annotation }) {
  const style = { left: `${a.x * 100}%`, top: `${a.y * 100}%` }
  switch (a.type) {
    case 'highlight':
      return <span className="pointer-events-none absolute h-3 w-28 -translate-x-1/2 -translate-y-1/2 rounded-sm opacity-50" style={{ ...style, backgroundColor: a.color }} />
    case 'underline':
      return <span className="pointer-events-none absolute h-0.5 w-28 -translate-x-1/2" style={{ ...style, backgroundColor: a.color }} />
    case 'strikeout':
      return <span className="pointer-events-none absolute h-0.5 w-28 -translate-x-1/2 -translate-y-1/2" style={{ ...style, backgroundColor: a.color }} />
    case 'rectangle':
      return <span className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2" style={{ ...style, borderColor: a.color }} />
    case 'stamp':
      return (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 px-2 py-0.5 font-mono text-[10px] font-bold"
          style={{ ...style, borderColor: a.color, color: a.color }}
        >
          {a.text}
        </span>
      )
    case 'note':
      return (
        <span
          className="pointer-events-none absolute flex max-w-28 -translate-x-1/2 -translate-y-1/2 items-start gap-1 rounded-md p-1.5 text-[9px] leading-tight text-black shadow-lg"
          style={{ ...style, backgroundColor: a.color }}
        >
          <StickyNote className="size-2.5 shrink-0" aria-hidden />
          {a.text}
        </span>
      )
  }
}
