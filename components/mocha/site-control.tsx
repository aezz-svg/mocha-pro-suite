'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Code2, Globe2, Hexagon, Home, Download } from 'lucide-react'

type Locale = 'ar' | 'en' | 'tr'
export type Contact = { name: string; url: string }
type SiteSettings = { password: string; greeting: string; brandName?: string; phone: string; startupMessage: string; commandsEnabled: boolean; siteEnabled: boolean; contacts: Contact[] }
export const SITE_SETTINGS_KEY = 'mocha-pro-admin-settings-v1'
export type AdminSiteSettings = SiteSettings
export const DEFAULT_SITE_SETTINGS: SiteSettings = { password: '2026', greeting: 'أهلاً بك في منصة العز للقمة السيادية', phone: '', startupMessage: '', commandsEnabled: true, siteEnabled: true, contacts: [] }

export function SiteControl({ marketing = false }: { marketing?: boolean }) {
  const [locale, setLocale] = useState<Locale>('ar')
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedLocale = localStorage.getItem('mocha-pro-locale') as Locale | null
    if (savedLocale === 'ar' || savedLocale === 'en' || savedLocale === 'tr') setLocale(savedLocale)
    try { setSettings({ ...DEFAULT_SITE_SETTINGS, ...JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}') }) } catch { /* use defaults */ }
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('mocha-pro-locale', locale)
  }, [locale])

  function enterDeveloper() {
    const value = window.prompt('أدخل رمز المدير')
    if (value === settings.password) { sessionStorage.setItem('mocha-admin-authorized', '1'); setOpen(false); window.location.assign('/admin') }
    else if (value !== null) setMessage('رمز المدير غير صحيح.')
  }
  const label = locale === 'ar' ? 'اللغة' : locale === 'tr' ? 'Dil' : 'Language'

  return <>
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/75 hover:border-amber-300/40">
        <Hexagon className="size-4 text-amber-300"/><span className="font-mono">{settings.brandName || 'MOCHA.PRO'}</span><ChevronDown className="size-3"/>
      </button>
      {open && <div className="absolute end-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#101013] p-2 shadow-2xl">
        <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5" href={marketing ? '#top' : '/'}><Home size={15}/>{locale === 'ar' ? 'الصفحة الرئيسية' : 'Home'}</a>
        <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5" href={marketing ? '#updates' : '/#updates'}><Download size={15}/>{locale === 'ar' ? 'التحميل والتحديثات' : 'Downloads & updates'}</a>
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-white/80 hover:bg-white/5" onClick={enterDeveloper}><Code2 size={15}/>{locale === 'ar' ? 'المطور' : 'Developer'}</button>
        <div className="my-1 border-t border-white/10"/><label className="flex items-center gap-2 px-3 py-2 text-xs text-white/50"><Globe2 size={14}/>{label}
          <select aria-label={label} value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="ms-auto bg-transparent text-white"><option className="bg-[#101013]" value="ar">العربية</option><option className="bg-[#101013]" value="en">English</option><option className="bg-[#101013]" value="tr">Türkçe</option></select>
        </label>
      </div>}
    </div>
    {message && <div className="fixed bottom-5 end-5 z-[70] rounded-xl border border-amber-300/20 bg-[#161416] px-4 py-3 text-sm text-white shadow-xl">{message}<button className="ms-3 text-white/50" onClick={() => setMessage('')}>×</button></div>}
  </>
}

export function readLocalGreeting(fallback: string) {
  if (typeof window === 'undefined') return fallback
  try { return (JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}') as Partial<SiteSettings>).greeting || fallback } catch { return fallback }
}
export function localSiteSettings(): SiteSettings {
  if (typeof window === 'undefined') return DEFAULT_SITE_SETTINGS
  try {
    const stored = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}') as Partial<SiteSettings>
    return { ...DEFAULT_SITE_SETTINGS, ...stored, contacts: Array.isArray(stored.contacts) ? stored.contacts : [] }
  } catch { return DEFAULT_SITE_SETTINGS }
}

export function saveLocalSiteSettings(settings: SiteSettings) { localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(settings)) }
