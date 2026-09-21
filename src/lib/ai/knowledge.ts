/**
 * Knowledge loader for the draft-reply agent. FA-1.14.
 *
 * Reads markdown files from docs/knowledge/ (or a test fixture dir) and
 * selects which files to inject into the draft prompt based on the inquiry's
 * country and assigned guide name.
 *
 * Selection rules:
 *   tone/        — always loaded
 *   destinations/ — loaded when country matches file's `country` frontmatter (case-insensitive)
 *   guides/      — loaded when guide_name matches file's `guide_name` frontmatter (case-insensitive)
 *   offers/      — reserved, not yet used
 *
 * Frontmatter format (YAML subset — only flat key: value and key: [list] supported):
 *   ---
 *   kind: tone | destination | guide | offer
 *   country: Iceland
 *   guide_name: Josh Hart
 *   regions: [Westfjords, Snæfellsnes]
 *   ---
 */

import fs from 'fs'
import path from 'path'

type KnowledgeKind = 'tone' | 'destination' | 'guide' | 'offer'

export interface KnowledgeFile {
  kind:       KnowledgeKind
  country:    string | null
  regions:    string[]
  guide_name: string | null
  content:    string
  path:       string
}

// ─── Frontmatter parser ───────────────────────────────────────────────────────

interface RawFrontmatter {
  kind?:       string
  country?:    string
  regions?:    string[]
  guide_name?: string
}

function parseFrontmatter(raw: string): { meta: RawFrontmatter; body: string } {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!fm) return { meta: {}, body: raw }

  const meta: RawFrontmatter = {}
  for (const line of fm[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.+)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim()

    if (val.startsWith('[') && val.endsWith(']')) {
      // Inline array: [a, b, c]
      const items = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
      ;(meta as Record<string, unknown>)[key] = items
    } else {
      ;(meta as Record<string, unknown>)[key] = val
    }
  }

  return { meta, body: fm[2] }
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export interface LoadKnowledgeParams {
  country?:      string | null
  guide?:        string | null
  /** Override the knowledge root for tests (absolute path). */
  knowledgeDir?: string
}

const DEFAULT_KNOWLEDGE_DIR = path.resolve(process.cwd(), 'docs/knowledge')

function readDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[knowledge] directory not found: ${dir}`)
    }
    return []
  }
}

function loadFile(filePath: string): KnowledgeFile | null {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const { meta, body } = parseFrontmatter(raw)
  const kind = meta.kind as KnowledgeKind | undefined

  if (!kind || !['tone', 'destination', 'guide', 'offer'].includes(kind)) return null

  return {
    kind,
    country:    meta.country ?? null,
    regions:    meta.regions ?? [],
    guide_name: meta.guide_name ?? null,
    content:    body.trim(),
    path:       filePath,
  }
}

export function loadKnowledge(params: LoadKnowledgeParams = {}): KnowledgeFile[] {
  const { country, guide, knowledgeDir = DEFAULT_KNOWLEDGE_DIR } = params
  const result: KnowledgeFile[] = []

  // 1. Tone — always
  for (const fname of readDir(path.join(knowledgeDir, 'tone'))) {
    const f = loadFile(path.join(knowledgeDir, 'tone', fname))
    if (f?.kind === 'tone') result.push(f)
  }

  // 2. Destination — only when country is known
  if (country) {
    const normalCountry = country.toLowerCase()
    for (const fname of readDir(path.join(knowledgeDir, 'destinations'))) {
      const f = loadFile(path.join(knowledgeDir, 'destinations', fname))
      if (f?.kind === 'destination' && f.country?.toLowerCase() === normalCountry) {
        result.push(f)
      }
    }
  }

  // 3. Guide — only when guide name is known
  if (guide) {
    const normalGuide = guide.toLowerCase()
    for (const fname of readDir(path.join(knowledgeDir, 'guides'))) {
      const f = loadFile(path.join(knowledgeDir, 'guides', fname))
      if (f?.kind === 'guide' && f.guide_name?.toLowerCase() === normalGuide) {
        result.push(f)
      }
    }
  }

  return result
}
