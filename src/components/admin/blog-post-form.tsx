'use client'

import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/admin/image-upload'
import { ArticleBody } from '@/components/blog/article-body'
import { saveBlogPost, setBlogPostStatus } from '@/actions/blog'
import { COUNTRIES } from '@/lib/countries'
import {
  BlogPostPayloadSchema,
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  IMAGE_ALT_MAX,
  PUBLISH_FIELD_LABELS,
  SEO_TITLE_MAX,
  TITLE_MAX,
  findDroppedHtml,
  suggestBlogSlug,
  type BlogPostPayload,
  type BlogStatus,
  type PublishField,
} from '@/lib/blog/editor'

// ─── Design-system micro-components (as in testimonial-form) ─────────────────

function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.55)' }}
    >
      {children}
      {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{children}</p>
}

const RED = '#B3261E'

const fieldStyle = { background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.1)', color: '#0A2E4D' }
const errorStyle = { background: '#F3EDE4', border: `1.5px solid ${RED}`, color: '#0A2E4D' }

function TextInput({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid === true ? true : undefined}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all disabled:opacity-60"
      style={invalid === true ? errorStyle : fieldStyle}
    />
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none"
      style={fieldStyle}
    />
  )
}

function TextArea({ invalid, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid === true ? true : undefined}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-y"
      style={invalid === true ? errorStyle : fieldStyle}
    />
  )
}

/** "34/60" — turns red and bold past the limit; the limit blocks saving (tj E1), it is not a hint. */
function Counter({ id, value, max }: { id: string; value: string; max: number }) {
  const over = value.length > max
  return (
    <p
      id={id}
      data-over={over ? 'true' : 'false'}
      aria-live="polite"
      className="mt-1 text-xs f-body tabular-nums"
      style={{ color: over ? RED : 'rgba(10,46,77,0.4)', fontWeight: over ? 700 : 400 }}
    >
      {value.length}/{max}{over ? ` — ${value.length - max} too many; shorten it to save` : ''}
    </p>
  )
}

// ─── Block cheat-sheet ────────────────────────────────────────────────────────

const CHEAT_SHEET = `:::warning
A red-tinted callout. Text inside is Markdown.
:::

:::info
A calmer note.
:::

:::stat{value="15 kg" label="per person"}
The note under the number.
:::

::photo{src="/fish_catalog/cod.png" alt="Atlantic cod" caption="Optional caption."}`

// ─── Props ────────────────────────────────────────────────────────────────────

export type BlogPostFormValues = {
  title: string
  slug: string
  seo_title: string
  description: string
  body_md: string
  image_url: string | null
  image_alt: string
  category: string
  country: string | null
  guide_id: string | null
}

export interface BlogPostFormProps {
  /** Null = a new post. */
  postId: string | null
  initialValues: BlogPostFormValues
  /** The state the post is in now. */
  initialStatus: BlogStatus
  /** Set once the post has been public; after that the slug is fixed. */
  initialPublishedAt: string | null
  guides: { id: string; name: string; country: string | null }[]
  /** A banner after a redirect from create. */
  notice?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BlogPostForm({ postId, initialValues, initialStatus, initialPublishedAt, guides, notice }: BlogPostFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [id, setId] = useState(postId)
  const [status, setStatus] = useState<BlogStatus>(initialStatus)
  const [everPublished, setEverPublished] = useState(initialStatus === 'published' || initialPublishedAt != null)

  const [title, setTitle] = useState(initialValues.title)
  const [slug, setSlug] = useState(initialValues.slug)
  // A new post follows its title until the author edits the slug; an existing one never does.
  const [slugTouched, setSlugTouched] = useState(postId != null)
  const [seoTitle, setSeoTitle] = useState(initialValues.seo_title)
  const [description, setDescription] = useState(initialValues.description)
  const [body, setBody] = useState(initialValues.body_md)
  const [imageUrl, setImageUrl] = useState<string | null>(initialValues.image_url)
  const [imageKey, setImageKey] = useState(0)
  const [imageAlt, setImageAlt] = useState(initialValues.image_alt)
  const [category, setCategory] = useState(initialValues.category)
  const [country, setCountry] = useState(initialValues.country ?? '')
  const [guideId, setGuideId] = useState(initialValues.guide_id ?? '')

  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState<PublishField[]>([])
  const [message, setMessage] = useState<string | null>(notice ?? null)
  const [savedSlug, setSavedSlug] = useState<string | null>(postId != null ? initialValues.slug : null)

  // Same rule as the server's `slugLockedFor`: published now, or published at some point before.
  const slugLocked = status === 'published' || everPublished

  const payload = (target: BlogStatus): BlogPostPayload => ({
    title,
    slug,
    seo_title: seoTitle,
    description,
    body_md: body,
    image_url: imageUrl,
    image_alt: imageAlt,
    category,
    country: country === '' ? null : country,
    guide_id: guideId === '' ? null : guideId,
    status: target,
  })

  // The same schema the server runs. Anything it refuses blocks both save buttons — the limits on the
  // SEO title and description apply to drafts too (the database refuses them). Cheap enough to run on
  // every render: the length checks are O(1) and nothing here is a network call.
  const issues: Record<string, string> = {}
  const checked = BlogPostPayloadSchema.safeParse(payload('draft'))
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const field = String(issue.path[0] ?? '')
      if (issues[field] == null) issues[field] = issue.message
    }
  }
  const blocked = Object.keys(issues).length > 0

  // The preview and the HTML check follow the text a beat behind the keys, so typing stays smooth.
  const deferredBody = useDeferredValue(body)
  const droppedHtml = useMemo(() => findDroppedHtml(deferredBody), [deferredBody])

  function onTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched && !slugLocked) setSlug(suggestBlogSlug(value))
  }

  function run(task: () => ReturnType<typeof saveBlogPost>) {
    if (isPending) return
    setError(null)
    setMissing([])
    setMessage(null)
    startTransition(async () => {
      const result = await task()
      if (!result.success) {
        setError(result.error)
        setMissing(result.missing ?? [])
        return
      }
      setStatus(result.status)
      if (result.status === 'published') setEverPublished(true)
      setSavedSlug(result.slug)
      setSlug(result.slug)
      if (id == null) {
        setId(result.id)
        router.replace(`/admin/blog/${result.id}?saved=1`)
        return
      }
      setMessage(result.status === 'published' ? 'Saved. The article is live.' : 'Saved as a draft. The article is not public.')
      router.refresh()
    })
  }

  const publishedNow = status === 'published'
  const missingSet = new Set(missing)
  const borderFor = (field: PublishField) => missingSet.has(field)

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (!blocked) run(() => saveBlogPost(id, payload(status))) }}
      className="space-y-6"
    >
      {message != null && (
        <div role="status" className="px-4 py-3 rounded-2xl text-sm f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
          {message}
          {publishedNow && savedSlug != null && (
            <>
              {' '}
              <Link href={`/blog/${savedSlug}`} target="_blank" className="underline font-semibold">View the article →</Link>
            </>
          )}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Title */}
        <div>
          <FieldLabel htmlFor="title" required>Title</FieldLabel>
          <TextInput id="title" value={title} onChange={e => onTitleChange(e.target.value)} invalid={issues.title != null && title !== ''} placeholder="The headline on the article page" />
          <Counter id="title-count" value={title} max={TITLE_MAX} />
          {issues.title != null && title !== '' && <p className="mt-1 text-xs f-body" style={{ color: RED }}>{issues.title}</p>}
        </div>

        {/* Slug */}
        <div>
          <FieldLabel htmlFor="slug" required>Address (slug)</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>/blog/</span>
            <TextInput
              id="slug"
              value={slug}
              disabled={slugLocked}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
              invalid={issues.slug != null && slug !== ''}
              placeholder="fishing-in-norway-2026"
            />
          </div>
          {slugLocked ? (
            <Hint>Fixed — this article has been public, and search engines know its address.</Hint>
          ) : (
            <Hint>Suggested from the title; edit it until the first publication. After that it cannot change.</Hint>
          )}
          {issues.slug != null && slug !== '' && <p className="mt-1 text-xs f-body" style={{ color: RED }}>{issues.slug}</p>}
        </div>

        {/* SEO */}
        <div className="p-4 rounded-2xl space-y-5" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <div>
            <FieldLabel htmlFor="seo_title">SEO title</FieldLabel>
            <TextInput
              id="seo_title"
              value={seoTitle}
              onChange={e => setSeoTitle(e.target.value)}
              invalid={seoTitle.length > SEO_TITLE_MAX || borderFor('seo_title')}
              placeholder="The title in the browser tab and in Google"
            />
            <Counter id="seo-title-count" value={seoTitle} max={SEO_TITLE_MAX} />
          </div>
          <div>
            <FieldLabel htmlFor="description">Meta description</FieldLabel>
            <TextArea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              invalid={description.length > DESCRIPTION_MAX || borderFor('description')}
              placeholder="The two lines under the title in Google, and the excerpt on the blog list"
            />
            <Counter id="description-count" value={description} max={DESCRIPTION_MAX} />
          </div>
          <Hint>Both are needed to publish. The limits are Google&rsquo;s — longer text is cut off in the results — and they apply to drafts too.</Hint>
        </div>

        {/* Category, country, guide */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel htmlFor="category" required>Category</FieldLabel>
            <TextInput id="category" value={category} onChange={e => setCategory(e.target.value)} invalid={issues.category != null} placeholder="Planning" />
            <Counter id="category-count" value={category} max={CATEGORY_MAX} />
          </div>
          <div>
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <SelectInput id="country" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">General — no country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="guide">Guide</FieldLabel>
            <SelectInput id="guide" value={guideId} onChange={e => setGuideId(e.target.value)}>
              <option value="">— none —</option>
              {guides.map(g => <option key={g.id} value={g.id}>{g.name}{g.country != null ? ` · ${g.country}` : ''}</option>)}
            </SelectInput>
          </div>
        </div>

        {/* Image */}
        <div>
          <ImageUpload
            key={imageKey}
            label="Hero image"
            currentUrl={imageUrl}
            variant="thumbnail"
            folder="blog"
            onUpload={url => setImageUrl(url)}
            hint="Needed to publish. JPEG, PNG or WebP; resized to 2000 px. It is also the picture in link previews."
          />
          {missingSet.has('image_url') && <p className="mt-1 text-xs f-body" style={{ color: RED }}>{PUBLISH_FIELD_LABELS.image_url} is required to publish.</p>}
          {imageUrl != null && (
            <button
              type="button"
              onClick={() => { setImageUrl(null); setImageKey(k => k + 1) }}
              className="mt-2 text-xs font-medium f-body underline"
              style={{ color: 'rgba(10,46,77,0.55)' }}
            >
              Remove image
            </button>
          )}
          <div className="mt-4">
            <FieldLabel htmlFor="image_alt">Image alt text</FieldLabel>
            <TextInput
              id="image_alt"
              value={imageAlt}
              onChange={e => setImageAlt(e.target.value)}
              invalid={imageAlt.length > IMAGE_ALT_MAX || borderFor('image_alt')}
              placeholder="Describe the picture for someone who cannot see it"
            />
            <Counter id="image-alt-count" value={imageAlt} max={IMAGE_ALT_MAX} />
          </div>
        </div>
      </div>

      {/* Body + preview */}
      <div>
        <FieldLabel htmlFor="body_md" required>Article text</FieldLabel>
        <details className="mb-3 text-sm f-body" style={{ color: '#0A2E4D' }}>
          <summary className="cursor-pointer font-semibold">Blocks you can use</summary>
          <p className="mt-2 text-xs" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Plain Markdown works as it is: <code>## heading</code>, <code>**bold**</code>, lists, links, tables. On top of it:
          </p>
          <pre className="mt-2 p-3 rounded-2xl text-xs overflow-x-auto" style={{ background: 'rgba(10,46,77,0.05)' }}>{CHEAT_SHEET}</pre>
        </details>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div>
            <TextArea
              id="body_md"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={28}
              invalid={borderFor('body_md') || issues.body_md != null}
              spellCheck
              placeholder="Write or paste Markdown here. The preview on the right is the article page's own renderer."
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.6 }}
            />
            {issues.body_md != null && <p className="mt-1 text-xs f-body" style={{ color: RED }}>{issues.body_md}</p>}
            <Hint>{body.trim() === '' ? 0 : body.trim().split(/\s+/).length} words</Hint>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>Preview</p>
            {droppedHtml.length > 0 && (
              <div role="alert" data-testid="html-warning" className="mb-3 px-4 py-3 rounded-2xl text-sm f-body" style={{ background: 'rgba(230,126,80,0.12)', border: '1px solid rgba(230,126,80,0.5)', color: '#0A2E4D' }}>
                <strong>HTML in the text will not be shown.</strong> The article page removes HTML tags
                (found: <code>{droppedHtml.join(' ')}</code>). Write it as Markdown instead.
              </div>
            )}
            <div data-testid="preview" className="rounded-2xl p-5 overflow-hidden" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
              {deferredBody.trim() === ''
                ? <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Nothing to preview yet.</p>
                : <ArticleBody markdown={deferredBody} />}
            </div>
          </div>
        </div>
      </div>

      {error != null && (
        <p role="alert" data-testid="form-error" className="text-sm f-body px-4 py-3 rounded-2xl" style={{ background: 'rgba(179,38,30,0.08)', color: RED }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        {publishedNow ? (
          <>
            <button
              type="button"
              disabled={isPending || blocked}
              onClick={() => run(() => saveBlogPost(id, payload('published')))}
              className="px-6 py-3 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#0A2E4D', color: '#F8FAFB' }}
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={isPending || id == null}
              onClick={() => {
                if (id != null && window.confirm('Unpublish this article? It disappears from the site, the blog list and the sitemap.')) {
                  run(() => setBlogPostStatus(id, 'draft'))
                }
              }}
              className="px-6 py-3 rounded-2xl text-sm font-semibold f-body disabled:opacity-40"
              style={{ border: '1.5px solid rgba(10,46,77,0.25)', color: '#0A2E4D' }}
            >
              Unpublish
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending || blocked}
              onClick={() => run(() => saveBlogPost(id, payload('draft')))}
              className="px-6 py-3 rounded-2xl text-sm font-semibold f-body disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: '1.5px solid rgba(10,46,77,0.25)', color: '#0A2E4D' }}
            >
              {isPending ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              disabled={isPending || blocked}
              onClick={() => run(() => saveBlogPost(id, payload('published')))}
              className="px-6 py-3 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#0A2E4D', color: '#F8FAFB' }}
            >
              Publish
            </button>
          </>
        )}
        <Link href="/admin/blog" className="text-sm f-body underline" style={{ color: 'rgba(10,46,77,0.55)' }}>Back to the list</Link>
        {blocked && (
          <span data-testid="blocked-reason" className="text-xs f-body" style={{ color: RED }}>
            Saving is off: {Object.values(issues)[0]}
          </span>
        )}
      </div>
    </form>
  )
}
