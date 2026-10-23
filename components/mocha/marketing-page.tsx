'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink, Code2, Mail, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { SiteControl, localSiteSettings } from './site-control'

const REPOSITORY = 'aezz-svg/mocha-pro-suite'
const RELEASES_URL = 'https://github.com/aezz-svg/mocha-pro-suite/releases/latest'
const WINDOWS_DOWNLOAD_URL = `${RELEASES_URL}/download/MochaPdfOptimizer_0.1.0_x64-setup.exe`
const LATEST_RELEASE_API = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest'

type Release = {
  tag_name: string
  name: string
  html_url: string
  published_at: string
  body: string | null
  assets: Array<{ name: string; browser_download_url: string }>
}

export function MarketingPage() {
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(() => ({ phone: '', brandName: 'MOCHA.PRO', greeting: 'أهلاً بك في منصة العز للقمة السيادية', contacts: [] as Array<{name:string;url:string}>, siteEnabled: true }))

  const checkUpdates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
      })
      if (response.status === 404) throw new Error('لا توجد نسخة منشورة بعد.')
      if (!response.ok) throw new Error('تعذر جلب معلومات الإصدارات (HTTP ' + response.status + ').')
      setRelease((await response.json()) as Release)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاتصال بخدمة الإصدارات.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkUpdates()
    const current = localSiteSettings()
    setSettings({ phone: current.phone, brandName: current.brandName || 'MOCHA.PRO', greeting: current.greeting, contacts: current.contacts, siteEnabled: current.siteEnabled })
  }, [checkUpdates])

  const releaseUrl = release?.html_url || RELEASES_URL

  if (!settings.siteEnabled) return <main className="grid min-h-screen place-items-center bg-[#050507] p-6 text-center text-white"><div><h1 className="text-2xl font-bold">الموقع متوقف مؤقتاً</h1><p className="mt-3 text-sm text-white/60">عدّل إعداد الموقع من لوحة المدير على هذا الجهاز لإظهاره مجدداً.</p><div className="mt-5 flex justify-center"><SiteControl marketing /></div></div></main>

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#top" className="font-mono text-xl font-bold tracking-tight" dir="ltr">
          {settings.brandName.split('.')[0]}<span className="text-amber-400">.{settings.brandName.split('.').slice(1).join('.') || 'PRO'}</span>
        </a>
        <nav className="flex items-center gap-4 text-sm text-white/65">
          <a className="hover:text-white" href="#features">الميزات</a>
          <a className="hover:text-white" href="#updates">التحديثات</a>
          <a className="hover:text-white" href="#contact">تواصل</a>
          <SiteControl marketing />
        </nav>
      </header>

      <section id="top" className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="absolute inset-x-1/4 top-8 -z-0 h-64 rounded-full bg-amber-500/10 blur-[110px]" />
        <p className="font-mono text-xs tracking-[0.3em] text-amber-300" dir="ltr">{settings.greeting}</p>
        <h1 className="mt-6 max-w-4xl text-balance text-4xl font-bold leading-tight sm:text-6xl">
          معالجة PDF محلية، مع تحكم كامل بملفاتك
        </h1>
        <p className="mt-6 max-w-2xl text-pretty leading-8 text-white/60">
          Mocha Pro تطبيق سطح مكتب يستخدم Ghostscript على جهازك. نزّل آخر إصدار من GitHub Releases، أو راجع سجل التحديثات قبل التثبيت.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href={WINDOWS_DOWNLOAD_URL} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black transition hover:bg-amber-300">
            <Download className="size-4" aria-hidden />
            فتح أحدث إصدار من Windows
          </a>
          <a href="#updates" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-white/80 hover:border-white/30 hover:text-white">
            <RefreshCw className="size-4" aria-hidden />
            التحديثات
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-3 sm:px-8">
        {[
          { icon: ShieldCheck, title: 'معالجة على جهازك', text: 'تُرسل ملفات PDF إلى محرك Ghostscript المحلي في تطبيق سطح المكتب.' },
          { icon: Zap, title: 'أدوات عملية', text: 'ضغط وإصلاح واستخراج صفحات ونصوص وتشفير ودمج للعمليات التي يدعمها المحرك.' },
          { icon: Code2, title: 'إصدارات موثقة', text: 'تُنشر ملفات التثبيت وسجل التغييرات في GitHub Releases.' },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Icon className="size-5 text-amber-300" aria-hidden />
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-white/55">{text}</p>
          </article>
        ))}
      </section>

      <section id="updates" className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-widest text-amber-300" dir="ltr">APP UPDATES</p>
              <h2 className="mt-2 text-2xl font-bold">آخر إصدار</h2>
            </div>
            <button type="button" onClick={() => void checkUpdates()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 hover:text-white disabled:opacity-50">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
              تحقق الآن
            </button>
          </div>

          {loading && <p className="mt-6 text-sm text-white/55">جارٍ التحقق من GitHub Releases…</p>}
          {!loading && error && (
            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-sm text-amber-100">{error}</p>
              <a href={RELEASES_URL} className="mt-3 inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200">
                عرض صفحة الإصدارات <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          )}
          {!loading && release && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-sm text-emerald-200">{release.tag_name}</span>
                <time className="text-xs text-white/45" dateTime={release.published_at}>
                  {new Date(release.published_at).toLocaleDateString('ar')}
                </time>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{release.name || release.tag_name}</h3>
              {release.body && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/55">{release.body}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={WINDOWS_DOWNLOAD_URL} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300">
                  <Download className="size-4" aria-hidden /> فتح أحدث إصدار من Windows
                </a>
                <a href={releaseUrl} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/75 hover:text-white">
                  تفاصيل الإصدار <ExternalLink className="size-4" aria-hidden />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer id="contact" className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-white/55 sm:px-8">
          <p>Mocha Pro · تطبيق معالجة PDF محلي</p>
          <div className="flex flex-wrap items-center gap-4"><a href={'https://github.com/' + REPOSITORY + '/issues/new'} className="inline-flex items-center gap-2 hover:text-amber-200"><Mail className="size-4" aria-hidden /> تواصل مع المطور عبر GitHub Issues</a>
          {settings.phone && <a href={'tel:' + settings.phone} className="hover:text-amber-200">{settings.phone}</a>}
          {settings.contacts.map(c => <a key={c.name+c.url} href={c.url} target="_blank" rel="noreferrer" className="hover:text-amber-200">{c.name}</a>)}</div>
        </div>
      </footer>
    </main>
  )
}
