'use client'

import dynamic from 'next/dynamic'

// استيراد ديناميكي مع إيقاف الـ SSR تماماً لضمان عدم حدوث أي خطأ Prerender أثناء بناء Vercel/Netlify
const MochaProvider = dynamic(() => import('@/components/mocha/mocha-provider').then((mod) => mod.MochaProvider), { ssr: false })
const SiteHeader = dynamic(() => import('@/components/mocha/site-header').then((mod) => mod.SiteHeader), { ssr: false })
const HeroBanner = dynamic(() => import('@/components/mocha/hero-banner').then((mod) => mod.HeroBanner), { ssr: false })
const UploadZone = dynamic(() => import('@/components/mocha/upload-zone').then((mod) => mod.UploadZone), { ssr: false })
const TelemetryGrid = dynamic(() => import('@/components/mocha/telemetry-grid').then((mod) => mod.TelemetryGrid), { ssr: false })
const SuiteTabs = dynamic(() => import('@/components/mocha/suite-tabs').then((mod) => mod.SuiteTabs), { ssr: false })
const Vault = dynamic(() => import('@/components/mocha/vault').then((mod) => mod.Vault), { ssr: false })

export default function Page() {
  return (
    <MochaProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-black">
        <SiteHeader />
        <main className="relative">
          <HeroBanner />
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 sm:px-6">
            <section aria-label="رفع المستند" className="flex flex-col gap-4">
              <UploadZone />
              <TelemetryGrid />
            </section>
            <SuiteTabs />
            <Vault />
          </div>
        </main>
        <footer className="border-t border-white/[0.06] py-6">
          <p className="mx-auto max-w-7xl px-4 text-center font-mono text-[11px] text-white/30 sm:px-6" dir="ltr">
            MOCHA PRO · SOVEREIGN CLOUD VAULT · SECURE GLOBAL UPLINK · PUBLIC ACCESS
          </p>
        </footer>
      </div>
    </MochaProvider>
  )
}