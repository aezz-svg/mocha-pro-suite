'use client'

import { Cpu, FolderOpen, Highlighter, LayoutGrid, ScanText, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ContentSuite } from './suites/content-suite'
import { EngineeringSuite } from './suites/engineering-suite'
import { FileSuite } from './suites/file-suite'
import { PagesSuite } from './suites/pages-suite'
import { ReviewSuite } from './suites/review-suite'
import { SecuritySuite } from './suites/security-suite'

const SUITES = [
  { id: 'file', code: '01', label: 'الملفات والملاحة', en: 'File & Navigation', icon: FolderOpen, Component: FileSuite },
  { id: 'pages', code: '02', label: 'تنظيم الصفحات', en: 'Page Organization', icon: LayoutGrid, Component: PagesSuite },
  { id: 'content', code: '03', label: 'المحتوى والتحرير', en: 'Content & Editing', icon: ScanText, Component: ContentSuite },
  { id: 'review', code: '04', label: 'المراجعة والترميز', en: 'Review & Markup', icon: Highlighter, Component: ReviewSuite },
  { id: 'security', code: '05', label: 'الأمان والنماذج', en: 'Security & Forms', icon: ShieldCheck, Component: SecuritySuite },
  { id: 'engineering', code: '06', label: 'الهندسة المتقدمة', en: 'Advanced Engineering', icon: Cpu, Component: EngineeringSuite },
] as const

export function SuiteTabs() {
  const [active, setActive] = useState<(typeof SUITES)[number]['id']>('file')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const current = SUITES.find((s) => s.id === active)!

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (index + dir + SUITES.length) % SUITES.length
    setActive(SUITES[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section id="suites" aria-labelledby="suites-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-neon" dir="ltr">
            CONTROL SUITES
          </p>
          <h2 id="suites-title" className="mt-1 text-xl font-bold text-white sm:text-2xl">
            الأجنحة التشغيلية
          </h2>
        </div>
        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
          SUITE {current.code} · {current.en}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="أجنحة Mocha Pro"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6"
      >
        {SUITES.map((suite, i) => {
          const selected = suite.id === active
          const Icon = suite.icon
          return (
            <button
              key={suite.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              id={`tab-${suite.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${suite.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(suite.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'group relative flex min-w-40 shrink-0 items-center gap-3 overflow-hidden rounded-xl border p-3 text-start transition-all sm:min-w-0',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon',
                selected
                  ? 'border-neon/60 bg-neon/15 shadow-neon'
                  : 'border-white/[0.07] bg-slate-deep/60 backdrop-blur-xl hover:border-white/20',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  selected ? 'bg-neon text-white' : 'bg-white/5 text-white/50 group-hover:text-white',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] text-white/40" dir="ltr">
                  S-{suite.code}
                </span>
                <span className={cn('block truncate text-xs font-semibold', selected ? 'text-white' : 'text-white/70')}>
                  {suite.label}
                </span>
              </span>
              {selected && <span className="absolute inset-x-3 bottom-0 h-px bg-gradient-to-l from-transparent via-neon to-transparent" />}
            </button>
          )
        })}
      </div>

      {SUITES.map(({ id, Component }) => (
        <div
          key={id}
          id={`panel-${id}`}
          role="tabpanel"
          aria-labelledby={`tab-${id}`}
          hidden={id !== active}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {id === active && <Component />}
        </div>
      ))}
    </section>
  )
}
