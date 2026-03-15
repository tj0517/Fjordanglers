import type { Metadata } from 'next'
import { Fraunces, DM_Sans } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'FjordAnglers — Epic Fjord Fishing Trips',
    template: '%s | FjordAnglers',
  },
  description:
    'Connect with expert Scandinavian fishing guides for unforgettable fjord fishing adventures. Salmon, trout, cod and more.',
  keywords: ['fishing', 'fjord', 'Norway', 'Scandinavia', 'fishing guide', 'salmon fishing'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://fjordanglers.com',
    siteName: 'FjordAnglers',
    title: 'FjordAnglers — Epic Fjord Fishing Trips',
    description: 'Connect with expert Scandinavian fishing guides for unforgettable fjord fishing adventures.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FjordAnglers — Epic Fjord Fishing Trips',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
