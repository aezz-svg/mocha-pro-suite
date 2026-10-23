import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mocha Pro — Local PDF Studio',
  description: 'موقع Mocha Pro الرسمي لتنزيل تطبيق سطح المكتب ومتابعة تحديثاته ومعالجة ملفات PDF محلياً عبر Ghostscript.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">`n        {children}\n      </body>
    </html>
  )
}
