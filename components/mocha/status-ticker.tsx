'use client'

const MESSAGES = [
  'MOCHA PRO · معالجة PDF محلياً',
  'GHOSTSCRIPT · محرك سطح المكتب',
  'WINDOWS RELEASES · GitHub',
  'خصوصية الملفات · تبقى على جهازك',
  'ضغط · دمج · استخراج · إصلاح · تشفير',
]

export function StatusTicker() {
  return (
    <div className="overflow-hidden border-y border-white/[0.06] bg-black/70 py-2" aria-label="حالة وميزات Mocha Pro">
      <div className="animate-ticker flex w-max items-center gap-8 whitespace-nowrap px-4 font-mono text-[10px] tracking-wider text-white/55" dir="ltr">
        {[...MESSAGES, ...MESSAGES].map((message, index) => (
          <span key={`${index}-${message}`} className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden />{message}
          </span>
        ))}
      </div>
      <span className="sr-only">{MESSAGES.join(' · ')}</span>
    </div>
  )
}
