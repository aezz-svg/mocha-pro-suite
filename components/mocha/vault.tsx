'use client'
import { Archive, Copy, FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatBytes } from '@/lib/pdf-inspect'
import { useMocha } from './mocha-provider'
import { GlassPanel, SectionTitle } from './primitives'
export function Vault() {
 const {vault,removeFromVault,clearVault}=useMocha(); const [copied,setCopied]=useState('')
 return <GlassPanel id="vault" className="p-5"><SectionTitle icon={Archive} title="سجل الملفات الناتجة" subtitle={`${vault.length} ملف محفوظ على جهازك`} action={vault.length>0?<button onClick={clearVault} className="text-xs text-white/60">إفراغ السجل</button>:undefined}/>{vault.length===0?<p className="mt-5 text-sm text-white/45">ستظهر هنا الملفات بعد معالجتها.</p>:<ul className="mt-4 space-y-2">{vault.map(x=><li key={x.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3"><FileText size={16} className="text-signal"/><span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs text-white" dir="ltr">{x.filename}</span><span className="text-xs text-muted-foreground">{formatBytes(x.size)} · {x.label}</span></span><button aria-label="نسخ مسار الملف" title={copied===x.id?'تم النسخ':'نسخ المسار'} onClick={async()=>{await navigator.clipboard.writeText(x.url);setCopied(x.id)}} className="text-white/60"><Copy size={15}/></button><button aria-label="إزالة من السجل" onClick={()=>removeFromVault(x.id)} className="text-white/50"><Trash2 size={15}/></button></li>)}</ul>}</GlassPanel>
}
