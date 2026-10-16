import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mocha Pro Suite - Sovereign Cloud Vault',
  description: 'منصة هندسية سحابية متكاملة لرفع وإدارة وثائق الـ PDF للعامة',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-black text-white antialiased selection:bg-white/20 selection:text-white">
        {children}
      </body>
    </html>
  )
}