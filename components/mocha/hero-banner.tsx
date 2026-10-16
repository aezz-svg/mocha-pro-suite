import { Coffee, Fingerprint, ShieldCheck, Zap } from 'lucide-react'
import Image from 'next/image'
import { AmbientAudioToggle } from './ambient-audio'
import { StatusTicker } from './status-ticker'

const pillars = [
  { icon: ShieldCheck, label: 'AES-256 سيادي' },
  { icon: Zap, label: 'معالجة محلية فائقة' },
  { icon: Fingerprint, label: 'صفر سحابة · صفر تتبّع' },
]

export function HeroBanner() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <Image
        src="/images/coffee-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center opacity-70"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-obsidian/70 via-obsidian/80 to-obsidian" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_10%,#030305_75%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gold/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 right-[8%] -z-10 h-56 w-56 rounded-full bg-neon/20 blur-[100px]" />

      <div className="pointer-events-none absolute bottom-16 left-1/2 -z-10 flex -translate-x-1/2 gap-6" aria-hidden>
        {[0, 1.8, 3.6].map((delay) => (
          <span
            key={delay}
            className="block h-28 w-6 animate-steam rounded-full bg-gradient-to-t from-white/0 via-amber-100/15 to-white/0 blur-md"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-20 sm:pb-16">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-3 py-1 font-mono text-[11px] tracking-wider text-signal"
            dir="ltr"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-signal shadow-signal" />
            SOVEREIGN PDF ENGINE · v5.0
          </span>
          <AmbientAudioToggle />
        </div>

        <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-amber-200/90">
          <Coffee className="size-4 text-gold" aria-hidden />
          أهلاً بك يا عزمي في القمة السيادية
        </p>

        <h1 id="hero-title" className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
          <span className="font-mono text-gold text-glow-gold" dir="ltr">
            Mocha Pro
          </span>
          <span className="mx-3 text-white/20" aria-hidden>
            |
          </span>
          <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">النظام الإمبراطوري الشامل للـ PDF</span>
        </h1>

        <p className="mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
          إرث القهوة الداكنة يلتقي بالهندسة السيادية: نظّم، حرّر، راجع، شفّر، وأرشف مستنداتك عبر محرك Python محلي لا يغادر جهازك أبداً.
        </p>

        <ul className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {pillars.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-white/80 backdrop-blur-xl"
            >
              <Icon className="size-3.5 text-gold" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <StatusTicker />
    </section>
  )
}
