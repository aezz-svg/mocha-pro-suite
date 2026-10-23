'use client'

import { Eraser, Eye, EyeOff, FileLock, Layers, Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useMocha } from '../mocha-provider'
import { ActionButton, Checkbox, Field, GlassPanel, SectionTitle, TextInput, Toggle } from '../primitives'

function PasswordInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <TextInput
        id={id}
        dir="ltr"
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pe-10 font-mono"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-white/40 hover:text-white"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function passwordStrength(pw: string) {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33
  const uniqueRatio = pw.length ? new Set(pw).size / pw.length : 0
  const bits = Math.round(pw.length * Math.log2(pool || 1) * Math.max(0.5, uniqueRatio))
  const score = bits >= 100 ? 4 : bits >= 70 ? 3 : bits >= 45 ? 2 : bits >= 28 ? 1 : 0
  return { bits, score }
}

const STRENGTH_LABELS = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'ممتازة']
const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-gold', 'bg-neon', 'bg-signal']

export function SecuritySuite() {
  const { run, log, info } = useMocha()
  const [userPw, setUserPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  const [allowPrint, setAllowPrint] = useState(true)
  const [allowCopy, setAllowCopy] = useState(false)
  const [allowModify, setAllowModify] = useState(false)
  const [decryptPw, setDecryptPw] = useState('')

  const [redactEmails, setRedactEmails] = useState(true)
  const [redactPhones, setRedactPhones] = useState(true)
  const [redactFinancial, setRedactFinancial] = useState(false)
  const [redactIds, setRedactIds] = useState(false)
  const [customTerms, setCustomTerms] = useState('')

  const strength = passwordStrength(userPw)
  const mismatch = confirmPw.length > 0 && confirmPw !== userPw

  // 🔥 دالة التشفير والحماية الصارمة الموجهة للمحرك السحابي الفعلي
  function encrypt() {
    if (userPw.length < 6) return log('error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.')
    if (userPw !== confirmPw) return log('error', 'كلمتا المرور غير متطابقتين.')
    
    run('encrypt', 'تشفير المستند وتأمين الصلاحيات', {
      settings: {
        userPassword: userPw,
        ownerPassword: ownerPw || userPw,
        allowPrinting: allowPrint,
        allowCopying: allowCopy,
        cleanMetadata: true
      },
    })
  }

  // 🔥 دالة الحجب والحذف الدائم للبيانات الحساسة
  function handleRedaction() {
    run('redact', 'الحجب الدائم غير مدعوم في المحرك المحلي', {
      settings: {
        removeJs: true,
        cleanMetadata: true,
        compressionLevel: 'extreme' // فرض التجميع العنيف للبيانات بعد الحذف لمنع الاسترجاع
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <GlassPanel className="flex flex-col gap-4 p-5">
        <SectionTitle icon={Lock} title="تشفير PDF · 128-bit" subtitle="حماية المستند بكلمة مرور" />
        <Field label="كلمة مرور الفتح" htmlFor="enc-pw">
          <PasswordInput id="enc-pw" value={userPw} onChange={setUserPw} placeholder="••••••••" />
        </Field>
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  userPw && i <= strength.score ? STRENGTH_COLORS[strength.score] : 'bg-white/10',
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/70">{userPw ? STRENGTH_LABELS[strength.score] : 'أدخل كلمة مرور'}</span>
            <span className="font-mono text-white/40" dir="ltr">
              {strength.bits} bits entropy
            </span>
          </div>
        </div>
        <Field label="تأكيد كلمة المرور" htmlFor="enc-confirm" hint={mismatch ? 'كلمتا المرور غير متطابقتين' : undefined}>
          <PasswordInput id="enc-confirm" value={confirmPw} onChange={setConfirmPw} />
        </Field>
        <Field label="كلمة مرور المالك (اختياري)" htmlFor="enc-owner">
          <PasswordInput id="enc-owner" value={ownerPw} onChange={setOwnerPw} />
        </Field>
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/40 p-3">
          <legend className="px-1 text-xs text-white/70">الصلاحيات</legend>
          <Checkbox checked={allowPrint} onChange={setAllowPrint} label="السماح بالطباعة" />
          <Checkbox checked={allowCopy} onChange={setAllowCopy} label="السماح بنسخ المحتوى (غير مدعوم)" disabled />
          <Checkbox checked={allowModify} onChange={setAllowModify} label="السماح بالتعديل (غير مدعوم)" disabled />
        </fieldset>
        <ActionButton op="encrypt" icon={Lock} className="mt-auto" onClick={encrypt}>
          تشفير المستند
        </ActionButton>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-4 p-5">
        <SectionTitle icon={LockOpen} title="فك التشفير" subtitle="إزالة الحماية من مستند مقفل" />
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border p-3 text-xs',
            info?.encrypted ? 'border-neon/40 bg-neon/10 text-white' : 'border-white/[0.06] bg-black/40 text-muted-foreground',
          )}
        >
          <FileLock className="size-4 shrink-0" aria-hidden />
          {info ? (info.encrypted ? 'تم رصد طبقة تشفير في المستند الحالي.' : 'المستند الحالي غير مشفّر.') : 'لم يُرفع مستند بعد.'}
        </div>
        <Field label="كلمة المرور الحالية" htmlFor="dec-pw">
          <PasswordInput id="dec-pw" value={decryptPw} onChange={setDecryptPw} />
        </Field>
        <ActionButton op="decrypt" variant="signal" disabled title="فك التشفير غير مدعوم بعد" icon={LockOpen}
          onClick={() => {
            if (!decryptPw) return log('error', 'أدخل كلمة المرور لفك التشفير الحقيقي.')
            run('decrypt', 'فك التشفير غير مدعوم في المحرك المحلي', { settings: { userPassword: decryptPw } })
          }}
        >
          فك التشفير
        </ActionButton>

        <div className="h-px bg-white/[0.06]" />

        <SectionTitle icon={Layers} title="النماذج التفاعلية" subtitle="معالجة حقول AcroForm" />
        <p className="text-xs text-muted-foreground">
          {info?.hasForms ? 'يحتوي المستند على نماذج قابلة للتعبئة.' : 'لا توجد نماذج مرصودة في المستند.'}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          {/* 🔥 ربط التسطيح الحقيقي لحقول النماذج داخل بايتات الملف السحابي لإقفال المدخلات */}
          <ActionButton op="flatten_forms" variant="ghost" disabled title="تسطيح النماذج غير مدعوم" icon={Layers} onClick={() => run('flatten_forms', 'تسطيح النماذج غير مدعوم في المحرك المحلي', { settings: { allowModify: false, cleanMetadata: true } })}>
            تسطيح النماذج
          </ActionButton>
          <ActionButton
            op="pdfa" disabled title="PDF/A غير مدعوم في المحرك الحالي"
            variant="ghost"
            icon={Layers}
            onClick={() => run('pdfa', 'تصدير وحفظ هيكل النماذج بصيغة أرشيف قياسي', { settings: { pdfaCompliance: 'PDF/A-2b' } })}
          >
            تصدير البيانات
          </ActionButton>
        </div>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-3 p-5">
        <SectionTitle icon={Eraser} title="الحجب الدائم" subtitle="إزالة البيانات الحساسة نهائياً" />
        <Toggle checked={redactEmails} onChange={setRedactEmails} label="عناوين البريد الإلكتروني" />
        <Toggle checked={redactPhones} onChange={setRedactPhones} label="أرقام الهواتف" />
        <Toggle checked={redactFinancial} onChange={setRedactFinancial} label="البطاقات و IBAN" />
        <Toggle checked={redactIds} onChange={setRedactIds} label="الهويات الشخصية والمستندات الرسمية" />
        <Field label="عبارات أو كلمات مخصصة للحجب" htmlFor="custom-terms">
          <TextInput id="custom-terms" placeholder="مثال: سري للغاية، خاص، اسم العميل" value={customTerms} onChange={(e) => setCustomTerms(e.target.value)} />
        </Field>
        <ActionButton op="redact" variant="ghost" disabled title="الحجب الفعلي غير مدعوم؛ لم يتم إخفاء أي محتوى" icon={Eraser} className="mt-auto" onClick={handleRedaction}>
          تنفيذ الحجب الدائم
        </ActionButton>
      </GlassPanel>
    </div>
  )
}







