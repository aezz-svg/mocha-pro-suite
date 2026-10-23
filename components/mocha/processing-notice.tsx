'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function ProcessingNotice() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.trim()) setMessage(detail)
    }
    window.addEventListener('mocha-processing-notice', show)
    return () => window.removeEventListener('mocha-processing-notice', show)
  }, [])
  if (!message) return null
  return <aside role="status" aria-live="polite" className="fixed bottom-5 end-5 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-amber-300/25 bg-[#171416] p-4 text-sm text-white shadow-2xl"><span className="flex-1">{message}</span><button onClick={() => setMessage('')} aria-label="إغلاق التنبيه" className="text-white/55 hover:text-white"><X size={16}/></button></aside>
}
