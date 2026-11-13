import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getSiteSettings } from '@/utilities/getSiteSettings'
import { getServerSideURL } from '@/utilities/getURL'

export const revalidate = 600

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** RSS 2.0 feed of the latest published posts, like WordPress's /feed. */
export async function GET() {
  const settings = await getSiteSettings()
  if (settings.enableRSS === false || settings.enableBlog === false) {
    return new Response('Not found', { status: 404 })
  }

  const payload = await getPayload({ config: configPromise })
  const site = getServerSideURL()
  const { docs } = await payload.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
    limit: 20,
    depth: 0,
    overrideAccess: false,
    select: { title: true, slug: true, excerpt: true, meta: true, publishedAt: true },
  })

  const items = docs
    .map((p) => {
      const link = `${site}/posts/${p.slug}`
      const description = p.excerpt || p.meta?.description || ''
      return `<item><title>${esc(p.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>${
        p.publishedAt ? `<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : ''
      }<description>${esc(description)}</description></item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(
    settings.siteTitle || 'UltimaPress',
  )}</title><link>${site}</link><description>${esc(settings.tagline || '')}</description><atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
