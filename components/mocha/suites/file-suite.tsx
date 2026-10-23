'use client'

import { FileOutput, FolderOpen, Save, ScanSearch, Search, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import { formatBytes } from '@/lib/pdf-inspect'
import { EngineTerminal } from '../engine-terminal'
import { useMocha } from '../mocha-provider'
import { ActionButton, Checkbox, Field, GlassPanel, SectionTitle, SelectInput, TextInput } from '../primitives'

type Match = { page: number; snippet: string }

export function FileSuite() {
  const { run, openFilePicker, file } = useMocha()
  const [saveName, setSaveName] = useState('')
  const [exportFormat, setExportFormat] = useState('docx')
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matches, setMatches] = useState<Match[] | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    const result = await run('search', 'البحث في المستند', {
      params: { query, case_sensitive: caseSensitive, whole_word: wholeWord },
      autoDownload: false,
    })
    if (result?.kind === 'json') setMatches((result.data.matches as Match[]) ?? [])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassPanel className="flex flex-col gap-5 p-5">
        <SectionTitle icon={FolderOpen} title="فتح وحفظ" subtitle="إدارة المستند النشط" />
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton variant="ghost" icon={FolderOpen} onClick={openFilePicker}>
            فتح مستند
          </ActionButton>
          <ActionButton
            op="save"
            icon={Save}
            onClick={() =>
              run('save', 'حفظ المستند', {
                params: { filename: saveName || file?.name || 'document.pdf', incremental: false },
              })
            }
          >
            حفظ نسخة
          </ActionButton>
        </div>
        <Field label="اسم ملف الحفظ" htmlFor="save-name" hint="اتركه فارغاً لاستخدام الاسم الأصلي.">
          <TextInput
            id="save-name"
            dir="ltr"
            placeholder={file?.name ?? 'document.pdf'}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
        </Field>

        <div className="h-px bg-white/[0.06]" />

        <SectionTitle icon={FileOutput} title="خيارات التصدير" subtitle="استخراج TXT متاح؛ الصيغ الأخرى تتطلب محركات إضافية" />
        <Field label="صيغة التصدير" htmlFor="export-format">
          <SelectInput id="export-format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="docx">Word (DOCX)</option>
            <option value="png">صور PNG (ZIP)</option>
            <option value="jpg">صور JPG (ZIP)</option>
            <option value="txt">نص خام (TXT)</option>
            <option value="html">صفحة ويب (HTML)</option>
          </SelectInput>
        </Field>
        <ActionButton
          op="export"
          icon={FileOutput}
          onClick={() => run('export', `التصدير إلى ${exportFormat.toUpperCase()}`, { params: { format: exportFormat } })}
        >
          تصدير المستند
        </ActionButton>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-5 p-5">
        <SectionTitle icon={Search} title="البحث والملاحة" subtitle="البحث النصي يحتاج إضافة محرك استخراج/بحث محلي" />
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <label htmlFor="doc-search" className="sr-only">
              نص البحث
            </label>
            <TextInput
              id="doc-search"
              type="search"
              placeholder="ابحث عن كلمة أو عبارة…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ActionButton op="search" icon={Search} type="submit" className="shrink-0" disabled title="محرك البحث داخل الصفحات غير مضمن حالياً">
              بحث
            </ActionButton>
          </div>
          <div className="flex flex-wrap gap-5">
            <Checkbox checked={caseSensitive} onChange={setCaseSensitive} label="مطابقة حالة الأحرف" />
            <Checkbox checked={wholeWord} onChange={setWholeWord} label="كلمة كاملة فقط" />
          </div>
        </form>

        <div className="min-h-40 flex-1 rounded-xl border border-white/[0.06] bg-black/40 p-3">
          {matches === null ? (
            <p className="py-10 text-center text-xs text-muted-foreground">ستظهر نتائج البحث هنا مع أرقام الصفحات.</p>
          ) : matches.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>
          ) : (
            <ul className="space-y-2">
              {matches.map((m, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5 text-xs">
                  <span className="shrink-0 rounded bg-neon/15 px-2 py-0.5 font-mono text-neon">p.{m.page}</span>
                  <span className="text-white/80">{m.snippet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassPanel>

      <MetadataInspector />

      <GlassPanel className="flex flex-col gap-4 p-5">
        <SectionTitle icon={TerminalSquare} title="مخرجات المحرك الحية" subtitle="سجل عمليات المعالجة المحلية" />
        <EngineTerminal className="h-80" />
      </GlassPanel>
    </div>
  )
}

function MetadataInspector() {
  const { file, info, run } = useMocha()
  const [remote, setRemote] = useState<Record<string, unknown> | null>(null)

  async function deepScan() {
    const result = await run('metadata', 'فحص البيانات الوصفية', { autoDownload: false })
    if (result?.kind === 'json') setRemote(result.data)
  }

  const localRows: [string, string][] = file
    ? [
        ['Filename', file.name],
        ['MIME', file.type || 'application/pdf'],
        ['Size', formatBytes(file.size)],
        ['Modified', new Date(file.lastModified).toISOString().replace('T', ' ').slice(0, 19)],
        ['PDF Version', info?.version ?? '—'],
        ['Producer', info?.producer ?? '—'],
        ['Pages', String(info?.pages ?? 0)],
        ['Objects', String(info?.objects ?? 0)],
      ]
    : []

  const remoteMeta = (remote?.metadata as Record<string, unknown> | undefined) ?? remote ?? {}
  const remoteRows = Object.entries(remoteMeta).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')

  return (
    <GlassPanel className="flex flex-col gap-4 p-5">
      <SectionTitle
        icon={ScanSearch}
        title="مفتش البيانات الوصفية"
        subtitle="تعرض المعلومات المحلية المتاحة؛ الفحص العميق غير منفذ"
        action={
          <ActionButton op="metadata" variant="ghost" icon={ScanSearch} disabled title="غير مدعوم في المحرك الحالي" onClick={deepScan} className="h-8 px-3 text-xs">
            فحص عميق
          </ActionButton>
        }
      />
      {localRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-muted-foreground">
          ارفع مستنداً لقراءة بصمته الوصفية.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-2" dir="ltr">
          {[...localRows, ...remoteRows.map(([k, v]) => [k, String(v)] as [string, string])].map(([k, v], i) => (
            <div key={`${k}-${i}`} className="flex flex-col gap-0.5 bg-black/70 px-3 py-2">
              <dt className={i >= localRows.length ? 'font-mono text-[10px] text-gold' : 'font-mono text-[10px] text-white/40'}>{k}</dt>
              <dd className="truncate font-mono text-xs text-white" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </GlassPanel>
  )
}




