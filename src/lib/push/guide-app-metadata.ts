/**
 * FA-M.12 — what makes a page part of the installable guide app: the manifest link and the iOS
 * home-screen tags. Only `/dashboard` (layout) and `/r/[token]` spread this in (tj 2026-11-25):
 * public pages carry no manifest, so anglers are never offered "Install app" and their HTML is
 * unchanged.
 */

import type { Metadata } from 'next'

export const guideAppMetadata = {
  manifest:    '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'FjordAnglers', statusBarStyle: 'default' },
  icons:       { apple: '/icons/apple-touch-icon.png' },
} satisfies Metadata
