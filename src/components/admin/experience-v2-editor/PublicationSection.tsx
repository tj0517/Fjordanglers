'use client'

import { useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addExperienceSlugAlias,
  removeExperienceSlugAlias,
  setExperiencePageVersion,
  type ExperienceV2EditorData,
} from '@/actions/experience-pages'
import { isActivePrimary, missingForV2 } from '@/lib/experiences/v2-editor'
import { Field, NativeSelect, Notice, SaveBar, Section, useSave } from './fields'

export function PublicationSection({ data }: { data: ExperienceV2EditorData }) {
  const { page, aliases } = data
  const [version, setVersion] = useState<1 | 2>(page.pageVersion)
  const [alias, setAlias]     = useState('')
  const versionSave = useSave()
  const aliasSave   = useSave()

  // From what the database holds now — the same list the action answers with.
  const missing = missingForV2({
    priceFromCents:      page.priceFromCents,
    activePrimaryGuides: data.guides.filter(isActivePrimary).length,
    suitedFor:           page.suitedFor,
  })

  function addAlias() {
    const slug = alias.trim()
    if (slug === '') return aliasSave.fail('Type the old slug first')
    aliasSave.run(async () => {
      const result = await addExperienceSlugAlias(page.id, slug)
      if (result.success) setAlias('')
      return result
    })
  }

  return (
    <Section
      id="v2-publication"
      title="Publication"
      description="Which template the public page uses, and old addresses that should lead here."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Page version" className="w-64">
          <NativeSelect
            aria-label="Page version"
            value={version}
            onChange={e => setVersion(e.target.value === '2' ? 2 : 1)}
          >
            <option value={1}>1 — current template</option>
            <option value={2}>2 — offer-centric template</option>
          </NativeSelect>
        </Field>
        <a
          href={`/experiences/${page.slug}?preview=v2`}
          target="_blank"
          rel="noreferrer"
          className="f-body inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="size-4" /> Preview v2
        </a>
      </div>

      {page.status !== 'active' && (
        <Notice tone="info">The preview opens only for an Active page — this one is “{page.status}”.</Notice>
      )}

      {missing.length > 0 && (
        <Notice tone="warning">
          Not ready for v2 yet — missing: {missing.join('; ')}.
        </Notice>
      )}

      <SaveBar
        label="Save page version"
        pending={versionSave.pending}
        state={versionSave.state}
        onSave={() => versionSave.run(() => setExperiencePageVersion(page.id, version))}
      />

      <div className="flex flex-col gap-2">
        <h3 className="f-body text-sm font-bold">Slug aliases</h3>
        <p className="f-body text-sm text-muted-foreground">
          After merging a twin page into this one: archive the old page, then add its slug here.
          /experiences/&lt;old slug&gt; then redirects permanently to /experiences/{page.slug}.
        </p>

        {aliases.length === 0 ? (
          <p className="f-body text-sm text-muted-foreground">No aliases.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {aliases.map(slug => (
              <li key={slug} className="f-body flex items-center gap-2 text-sm">
                <code className="rounded bg-muted px-1.5 py-0.5">/experiences/{slug}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove alias ${slug}`}
                  disabled={aliasSave.pending}
                  onClick={() => aliasSave.run(() => removeExperienceSlugAlias(page.id, slug))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <Field label="Old slug" className="flex-1">
            <Input aria-label="Old slug" value={alias} onChange={e => setAlias(e.target.value)} placeholder="old-page-slug" />
          </Field>
        </div>
        <SaveBar label="Add alias" pending={aliasSave.pending} state={aliasSave.state} onSave={addAlias} />
      </div>
    </Section>
  )
}
