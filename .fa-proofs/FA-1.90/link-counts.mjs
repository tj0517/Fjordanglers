#!/usr/bin/env node
// FA-1.90 — count unique internal links inside <main> (nav and footer excluded by construction).
//
//   node .fa-proofs/FA-1.90/link-counts.mjs http://localhost:3001/ http://localhost:3001/norway …
//
// For each URL: HTTP status, how many <main> elements the HTML has (expected: 1), and the unique
// internal hrefs inside the first <main>, grouped by prefix — /experiences/, /guides/, /blog/, hub
// (a path equal to a hub slug from src/lib/destinations.ts), other. <script> bodies are dropped first,
// so JSON-LD and the RSC payload never count. A href is internal when it starts with a single "/" or
// points at the page's own origin / fjordanglers.com; query and hash are stripped before de-duplication.
// The audit's extractor is not in the repo; this replaces it.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// docs/05-agent-operations.md §10: every proof script starts behind the fake flag. This one only
// sends GETs, and only to a local server — anything else is refused before the first request.
if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

const repoRoot =resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const destinationsTs = readFileSync(resolve(repoRoot, 'src/lib/destinations.ts'), 'utf8')
const hubBlock = destinationsTs.slice(destinationsTs.indexOf('DESTINATION_HUBS'))
const HUB_SLUGS = [...hubBlock.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map(m => m[1])

const urls = process.argv.slice(2)
if (urls.length === 0) {
  console.error('usage: node link-counts.mjs <url> [<url> …]')
  process.exit(2)
}
for (const u of urls) {
  const { hostname } = new URL(u)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.error(`STOP: ${u} is not a local server`)
    process.exit(2)
  }
}

function internalPath(href, origin) {
  const raw = href.replace(/&amp;/g, '&').trim()
  let url
  if (raw.startsWith('/') && !raw.startsWith('//')) url = new URL(raw, origin)
  else if (/^https?:\/\//i.test(raw)) {
    url = new URL(raw)
    const host = url.host.replace(/^www\./, '')
    if (url.origin !== origin && host !== 'fjordanglers.com') return null
  } else return null
  return url.pathname.replace(/\/+$/, '') || '/'
}

function group(path) {
  if (path.startsWith('/experiences/')) return '/experiences/'
  if (path.startsWith('/guides/')) return '/guides/'
  if (path.startsWith('/blog/')) return '/blog/'
  if (HUB_SLUGS.includes(path.slice(1))) return 'hub'
  return 'other'
}

let failed = false
for (const target of urls) {
  const res = await fetch(target, { redirect: 'manual' })
  const html = await res.text()
  const origin = new URL(target).origin
  const mainCount = (html.match(/<main[\s>]/g) ?? []).length

  console.log(`\n=== ${target}`)
  console.log(`status ${res.status} · <main> elements: ${mainCount}`)
  if (mainCount === 0) {
    console.log('no <main> — nothing counted')
    failed = true
    continue
  }

  const start = html.search(/<main[\s>]/)
  const end = html.indexOf('</main>', start)
  const main = html.slice(start, end === -1 ? undefined : end).replace(/<script\b[\s\S]*?<\/script>/g, '')

  const paths = new Set()
  for (const m of main.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const p = internalPath(m[1], origin)
    if (p != null) paths.add(p)
  }

  const groups = { '/experiences/': [], '/guides/': [], '/blog/': [], hub: [], other: [] }
  for (const p of [...paths].sort()) groups[group(p)].push(p)

  console.log(`unique internal hrefs in <main>: ${paths.size}`)
  for (const [name, list] of Object.entries(groups)) {
    console.log(`  ${name.padEnd(14)} ${String(list.length).padStart(3)}  ${list.join(' ')}`)
  }
}

process.exit(failed ? 1 : 0)
