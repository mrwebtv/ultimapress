import crypto from 'crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionConfig, Config, Endpoint, GlobalConfig, PayloadRequest } from 'payload'

/**
 * Changes made by connected Claude arrive through /api/mcp, which answers as a stream.
 * Next.js drops cache refreshes requested from inside a streamed answer, so the public
 * site kept showing the old version. After such a change the site now asks itself, in a
 * separate ordinary request, to refresh every public page.
 */

const token = () =>
  crypto
    .createHash('sha256')
    .update(`${process.env.PAYLOAD_SECRET || ''}:site-refresh`)
    .digest('hex')

const ALWAYS = ['global_site-settings', 'global_header', 'global_footer', 'pages-sitemap', 'posts-sitemap', 'redirects']

/** POST /api/site-refresh: only the site itself can call it. */
export const siteRefreshEndpoint: Endpoint = {
  path: '/site-refresh',
  method: 'post',
  handler: async (req) => {
    const given = req.headers.get('x-up-refresh') || ''
    const expected = token()
    if (
      given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }
    let extra: string[] = []
    try {
      const body = (await req.json?.()) as { tags?: unknown }
      if (Array.isArray(body?.tags)) {
        extra = body.tags.filter((t): t is string => typeof t === 'string').slice(0, 50)
      }
    } catch {
      // No body is fine.
    }
    for (const tag of new Set([...ALWAYS, ...extra])) revalidateTag(tag, { expire: 0 })
    revalidatePath('/', 'layout')
    return Response.json({ ok: true })
  },
}

const fromClaude = (req: PayloadRequest) => {
  const where = `${req.pathname || ''} ${req.url || ''}`
  return where.includes('/api/mcp')
}

let waiting: ReturnType<typeof setTimeout> | null = null
const tags = new Set<string>()

function scheduleRefresh(tag?: string) {
  if (tag) tags.add(tag)
  if (waiting) clearTimeout(waiting)
  waiting = setTimeout(() => {
    waiting = null
    const body = JSON.stringify({ tags: [...tags] })
    tags.clear()
    fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/site-refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-up-refresh': token() },
      body,
    }).catch(() => {
      // The change itself is saved; the page will refresh when its cache runs out.
    })
  }, 250)
}

/** Adds the refresh to every collection and global, so new features are covered too. */
export const refreshAfterClaude = (config: Config): Config => ({
  ...config,
  collections: (config.collections || []).map(
    (c): CollectionConfig => ({
      ...c,
      hooks: {
        ...c.hooks,
        afterChange: [
          ...(c.hooks?.afterChange || []),
          ({ doc, req }) => {
            if (fromClaude(req)) scheduleRefresh(doc?.slug ? `${c.slug}_${doc.slug}` : undefined)
            return doc
          },
        ],
        afterDelete: [
          ...(c.hooks?.afterDelete || []),
          ({ doc, req }) => {
            if (fromClaude(req)) scheduleRefresh(doc?.slug ? `${c.slug}_${doc.slug}` : undefined)
            return doc
          },
        ],
      },
    }),
  ),
  globals: (config.globals || []).map(
    (g): GlobalConfig => ({
      ...g,
      hooks: {
        ...g.hooks,
        afterChange: [
          ...(g.hooks?.afterChange || []),
          ({ doc, req }) => {
            if (fromClaude(req)) scheduleRefresh(`global_${g.slug}`)
            return doc
          },
        ],
      },
    }),
  ),
})
