'use client'

import { Archive, Cpu, Palette, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'
import { formatBytes } from '@/lib/pdf-inspect'
import { useMocha } from '../mocha-provider'
import { ActionButton, Checkbox, Field, GlassPanel, SectionTitle, Segmented, SelectInput } from '../primitives'

type ColorMode = 'RGB' | 'Grayscale' | 'Monochrome'
type Level = 'low' | 'balanced' | 'extreme'

const DPI_PRESETS = [72, 150, 200, 300]

export function EngineeringSuite() {
  const { run, file } = useMocha()
  const [dpi, setDpi] = useState(150)
  const [colorMode, setColorMode] = useState<ColorMode>('RGB')
  const [level, setLevel] = useState<Level>('balanced')
  const [stripMetadata, setStripMetadata] = useState(true)
  const [removeJs, setRemoveJs] = useState(true)
  const [linearize, setLinearize] = useState(false)
  const [conformance, setConformance] = useState('2b')

  const levelFactor = { low: 0.85, balanced: 0.6, extreme: 0.35 }[level]
  const colorFactor = { RGB: 1, Grayscale: 0.7, Monochrome: 0.35 }[colorMode]
  const estimate = file ? file.size * levelFactor * colorFactor * Math.min(1, (dpi / 300) * 1.3) : 0

  // تجهيز مصفوفة الإعدادات المتقدمة لإرسالها بشكل حقيقي وصارم للـ API السحابي
  const advancedSettings = {
    dpi,
    compressionLevel: level,
    colorMode: colorMode.toLowerCase(),
    removeJs,
    cleanMetadata: stripMetadata,
    linearize,
    pdfaCompliance: `PDF/A-${conformance}`
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <GlassPanel className="flex flex-col gap-5 p-5 lg:col-span-3">
        <SectionTitle icon={Cpu} title="محرك التحسين والضغط" subtitle="معايرة دقيقة لجودة وحجم المخرجات" />

        <Field label="دقة الصور النقطية (DPI)" htmlFor="dpi">
          <div className="flex items-center gap-4">
            <input
              id="dpi"
              type="range"
              min={72}
              max={300}
              step={1}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer"
              dir="ltr"
              aria-valuetext={`${dpi} DPI`}
            />
            <output htmlFor="dpi" className="w-20 rounded-md border border-neon/40 bg-neon/10 py-1 text-center font-mono text-sm text-neon">
              {dpi}
            </output>
          </div>
          <div className="mt-2 flex gap-2">
            {DPI_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDpi(p)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] ${dpi === p ? 'bg-neon text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نمط الألوان" htmlFor="color-mode">
            <SelectInput id="color-mode" value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)}>
              <option value="RGB">RGB — ألوان كاملة</option>
              <option value="Grayscale">Grayscale — تدرّج رمادي</option>
              <option value="Monochrome" disabled>Monochrome — غير مدعوم بعد</option>
            </SelectInput>
          </Field>
          <Field label="مستوى الضغط">
            <Segmented
              label="مستوى الضغط"
              value={level}
              onChange={setLevel}
              options={[
                { value: 'low', label: 'خفيف' },
                { value: 'balanced', label: 'متوازن' },
                { value: 'extreme', label: 'أقصى' },
              ]}
            />
          </Field>
        </div>

        <fieldset className="grid gap-3 rounded-lg border border-white/[0.06] bg-black/40 p-4 sm:grid-cols-3">
          <legend className="px-1 text-xs text-white/70">التنظيف والتحسين</legend>
          <Checkbox checked={stripMetadata} onChange={setStripMetadata} label="تنظيف البيانات الوصفية (غير مفعّل)" disabled />
          <Checkbox checked={removeJs} onChange={setRemoveJs} label="إزالة JavaScript (غير مفعّل)" disabled />
          <Checkbox checked={linearize} onChange={setLinearize} label="تحسين للويب غير مفعّل حالياً" disabled />
        </fieldset>

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          {/* 🔥 ربط الزر الحقيقي وتمرير مصفوفة الـ settings المتقدمة والصارمة إلى دالة الـ run المحدثة */}
          <ActionButton op="compress" icon={Zap} onClick={() => run('compress', 'تنفيذ الضغط', { settings: advancedSettings })}>
            تنفيذ الضغط
          </ActionButton>
          <ActionButton
            op="sanitize" disabled title="تنظيف PDF غير مدعوم في المحرك الحالي"
            variant="ghost"
            icon={Sparkles}
            onClick={() => run('sanitize', 'تنظيف البيانات الوصفية غير مدعوم حالياً', { settings: { ...advancedSettings, compressionLevel: 'low' } })}
          >
            تنفيذ التنظيف الفعلي
          </ActionButton>
        </div>
      </GlassPanel>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <GlassPanel className="p-5">
          <SectionTitle icon={Palette} title="تقدير المخرجات" subtitle="محاكاة تقريبية قبل التنفيذ" />
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono" dir="ltr">
            <div className="rounded-lg border border-white/[0.06] bg-black/40 p-3">
              <dt className="text-[10px] text-white/40">INPUT</dt>
              <dd className="text-lg text-white">{formatBytes(file?.size ?? 0)}</dd>
            </div>
            <div className="rounded-lg border border-signal/30 bg-signal/5 p-3">
              <dt className="text-[10px] text-signal/70">≈ OUTPUT</dt>
              <dd className="text-lg text-signal">{formatBytes(Math.round(estimate))}</dd>
            </div>
          </dl>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
            {dpi}dpi · {colorMode} · {level}
          </p>
        </GlassPanel>

        <GlassPanel className="flex flex-1 flex-col gap-4 p-5">
          <SectionTitle icon={Archive} title="الأرشفة PDF/A" subtitle="معيار ISO 19005 للحفظ طويل الأمد" />
          <Field label="مستوى المطابقة" htmlFor="pdfa-level">
            <SelectInput id="pdfa-level" value={conformance} onChange={(e) => setConformance(e.target.value)}>
              <option value="1b">PDF/A-1b</option>
              <option value="2b">PDF/A-2b (موصى به)</option>
              <option value="3b">PDF/A-3b</option>
            </SelectInput>
          </Field>
          {/* 🔥 ربط زر الأرشفة الدولي وتمرير معيار الـ PDF/A الصارم برمجياً إلى السيرفر */}
          <ActionButton
            op="pdfa" disabled title="PDF/A غير مدعوم في المحرك الحالي"
            variant="signal"
            icon={Archive}
            className="mt-auto"
            onClick={() => run('pdfa', `التحويل إلى PDF/A-${conformance}`, { settings: advancedSettings })}
          >
            تحويل إلى PDF/A
          </ActionButton>
        </GlassPanel>
      </div>
    </div>
  )
}




