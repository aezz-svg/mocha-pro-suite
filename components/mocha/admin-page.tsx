'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Globe2, Save, ShieldCheck, LogOut } from 'lucide-react'
import { DEFAULT_SITE_SETTINGS, localSiteSettings, saveLocalSiteSettings, type AdminSiteSettings } from './site-control'

export function AdminPage() {
  const [settings, setSettings] = useState<AdminSiteSettings>(DEFAULT_SITE_SETTINGS)
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [locale, setLocale] = useState('ar')
  const [socialText, setSocialText] = useState('')
  useEffect(() => {
    const current = localSiteSettings(); setSettings(current)
    setSocialText(current.contacts.map(({name,url}) => `${name}|${url}`).join('\n'))
    setUnlocked(sessionStorage.getItem('mocha-admin-authorized') === '1')
    const lang = localStorage.getItem('mocha-pro-locale') || 'ar'; setLocale(lang)
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [])
  function authenticate(event: React.FormEvent) {
    event.preventDefault()
    if (code === settings.password) { sessionStorage.setItem('mocha-admin-authorized','1'); setUnlocked(true); setNotice('تم فتح لوحة الإعدادات.') }
    else setNotice('رمز المدير غير صحيح.')
  }
  function persist() {
    const contacts = socialText.split('\n').map(line => { const [name,...url] = line.split('|'); return { name: name.trim(), url: url.join('|').trim() } }).filter(c => c.name && /^https:\/\//i.test(c.url))
    const next = { ...settings, contacts }; setSettings(next); saveLocalSiteSettings(next); setNotice('حُفظت الإعدادات محلياً لهذا المتصفح.')
  }
  function changeLocale(value: string) { setLocale(value); localStorage.setItem('mocha-pro-locale',value); document.documentElement.lang=value; document.documentElement.dir=value==='ar'?'rtl':'ltr' }
  return <main className="min-h-screen bg-[#070709] px-4 py-8 text-white sm:px-8"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"><div><p className="font-mono text-xs tracking-widest text-amber-300">MOCHA.PRO · ADMIN</p><h1 className="mt-2 text-2xl font-bold">إعدادات الموقع والتطبيق</h1></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs"><Globe2 size={15}/><select value={locale} onChange={e=>changeLocale(e.target.value)} className="bg-transparent"><option className="bg-black" value="ar">العربية</option><option className="bg-black" value="en">English</option></select></label><a href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70"><ArrowLeft size={15}/> العودة</a></div></header>
    {!unlocked ? <form onSubmit={authenticate} className="mx-auto mt-16 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6"><ShieldCheck className="size-7 text-amber-300"/><h2 className="mt-4 text-lg font-semibold">تأكيد هوية المدير</h2><p className="mt-2 text-sm text-white/55">أدخل رمز المدير. الرمز الافتراضي 2026.</p><input autoFocus type="password" value={code} onChange={e=>setCode(e.target.value)} className="mt-5 w-full rounded-lg border border-white/10 bg-black/30 p-3" aria-label="رمز المدير"/><button className="mt-3 w-full rounded-lg bg-amber-300 px-4 py-3 font-semibold text-black">دخول</button>{notice&&<p className="mt-3 text-sm text-amber-200">{notice}</p>}</form> : <>
      <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-7 text-amber-100/75">الإعدادات هنا محفوظة في المتصفح الحالي فقط. لا يتضمن المشروع مخزناً خادمياً مشتركاً؛ لذلك لا تتغير إعدادات زوار Vercel الآخرين، ولا يُعد رمز المتصفح حماية خادمية. للإدارة المركزية يلزم ربط قاعدة بيانات وإضافة أسرارها إلى إعدادات Vercel.</div>
      <section className="mt-6 grid gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
        <label className="text-sm text-white/65">اسم العلامة<input value={settings.brandName||'MOCHA.PRO'} onChange={e=>setSettings({...settings,brandName:e.target.value})} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white"/></label>
        <label className="text-sm text-white/65">عبارة الترحيب<input value={settings.greeting} onChange={e=>setSettings({...settings,greeting:e.target.value})} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white"/></label>
        <label className="text-sm text-white/65">رقم الهاتف<input value={settings.phone} onChange={e=>setSettings({...settings,phone:e.target.value})} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white" placeholder="+967…"/></label>
        <label className="text-sm text-white/65">رمز المدير الجديد<input type="password" value={settings.password} onChange={e=>setSettings({...settings,password:e.target.value})} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white"/></label>
        <label className="text-sm text-white/65 sm:col-span-2">رسالة بعد اكتمال المعالجة بخمس ثوانٍ<input value={settings.startupMessage} onChange={e=>setSettings({...settings,startupMessage:e.target.value})} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white"/></label>
        <label className="text-sm text-white/65 sm:col-span-2">قنوات التواصل؛ كل سطر: الاسم|رابط HTTPS<textarea value={socialText} onChange={e=>setSocialText(e.target.value)} className="mt-2 min-h-32 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white" placeholder={'WhatsApp|https://wa.me/...\nTelegram|https://t.me/...\nFacebook|https://facebook.com/...'} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.siteEnabled} onChange={e=>setSettings({...settings,siteEnabled:e.target.checked})}/> الموقع ظاهر في هذا المتصفح</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.commandsEnabled} onChange={e=>setSettings({...settings,commandsEnabled:e.target.checked})}/> السماح بأوامر المعالجة على هذا الجهاز</label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="button" onClick={persist} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 font-semibold text-black"><Save size={16}/>حفظ الإعدادات</button><button type="button" onClick={()=>{sessionStorage.removeItem('mocha-admin-authorized');setUnlocked(false)}} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-white/70"><LogOut size={15}/>إنهاء الجلسة</button>{notice&&<span role="status" className="self-center text-sm text-emerald-200">{notice}</span>}</div>
      </section></>}
  </div></main>
}
