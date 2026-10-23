'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { MarketingPage } from '@/components/mocha/marketing-page'
import { ProcessingNotice } from '@/components/mocha/processing-notice'

const MochaProvider = dynamic(() => import('@/components/mocha/mocha-provider').then((mod) => mod.MochaProvider), { ssr: false })
const SiteHeader = dynamic(() => import('@/components/mocha/site-header').then((mod) => mod.SiteHeader), { ssr: false })
const HeroBanner = dynamic(() => import('@/components/mocha/hero-banner').then((mod) => mod.HeroBanner), { ssr: false })
const UploadZone = dynamic(() => import('@/components/mocha/upload-zone').then((mod) => mod.UploadZone), { ssr: false })
const TelemetryGrid = dynamic(() => import('@/components/mocha/telemetry-grid').then((mod) => mod.TelemetryGrid), { ssr: false })
const SuiteTabs = dynamic(() => import('@/components/mocha/suite-tabs').then((mod) => mod.SuiteTabs), { ssr: false })
const Vault = dynamic(() => import('@/components/mocha/vault').then((mod) => mod.Vault), { ssr: false })
const MochaGlobalStatus = dynamic(() => import('@/components/mocha/mocha-global-status').then((mod) => mod.MochaGlobalStatus), { ssr: false })
const StatusTicker = dynamic(() => import('@/components/mocha/status-ticker').then((mod) => mod.StatusTicker), { ssr: false })

function DesktopDashboard() {
  return (
    <MochaProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-black">
        <SiteHeader />
        <main className="relative">
          <HeroBanner />
          <StatusTicker />
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 sm:px-6">
            <section aria-label="ملف PDF" className="flex flex-col gap-4">
              <UploadZone />
              <TelemetryGrid />
            </section>
            <SuiteTabs />
            <Vault />
          </div>
        </main>
        <footer className="border-t border-white/[0.06] py-6">
          <p className="mx-auto max-w-7xl px-4 text-center font-mono text-[11px] text-white/30 sm:px-6" dir="ltr">
            MOCHA PRO · LOCAL GHOSTSCRIPT ENGINE · YOUR FILES STAY ON YOUR DEVICE
          </p>
        </footer>
        <MochaGlobalStatus />
        <ProcessingNotice />
      </div>
    </MochaProvider>
  )
}

export default function Page() {
  const [isDesktopApp, setIsDesktopApp] = useState(false)

  useEffect(() => {
    setIsDesktopApp(Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__))
  }, [])

  return isDesktopApp ? <DesktopDashboard /> : <MarketingPage />
}





