import type { Metadata } from 'next'
import { MochaProvider } from '@/components/mocha/mocha-provider'
import { MochaGlobalStatus } from '@/components/mocha/mocha-global-status'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mocha Pro Suite - محرك معالجة الوثائق السحابي',
  description: 'منصة احترافية متكاملة لمعالجة وإدارة ملفات الـ PDF عبر سحابة Google Drive السيادية',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <MochaProvider>
          {/* المحتوى الرئيسي لجميع صفحات التطبيق */}
          {children}
          
          {/* شريط الحالة والنسبة المئوية العائم (يعمل في حالات الاستدعاء، المعالجة، والتحميل) */}
          <MochaGlobalStatus />
        </MochaProvider>
      </body>
    </html>
  )
}