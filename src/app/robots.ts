import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/auth/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/plan-your-trip/',
        ],
      },
    ],
    sitemap: 'https://fjordanglers.com/sitemap.xml',
  }
}
