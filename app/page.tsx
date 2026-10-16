import { HeroBanner } from '@/components/mocha/hero-banner'
import { MochaProvider } from '@/components/mocha/mocha-provider'
import { SiteHeader } from '@/components/mocha/site-header'
import { SuiteTabs } from '@/components/mocha/suite-tabs'
import { TelemetryGrid } from '@/components/mocha/telemetry-grid'
import { UploadZone } from '@/components/mocha/upload-zone'
import { Vault } from '@/components/mocha/vault'

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