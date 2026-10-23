'use client'
import { SiteControl } from './site-control'
export function SiteHeader() {
 return <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6"><SiteControl/><span className="rounded-md border border-signal/30 bg-signal/10 px-3 py-1 text-xs text-signal">معالجة محلية · Ghostscript</span></div></header>
}
