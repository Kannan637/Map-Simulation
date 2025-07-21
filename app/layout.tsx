import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'map-app',
  description: 'map-app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
