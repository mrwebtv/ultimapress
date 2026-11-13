import type { Payload, PayloadRequest } from 'payload'
import { XMLParser } from 'fast-xml-parser'
import { JSDOM } from 'jsdom'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import crypto from 'crypto'
import path from 'path'

/** Text only: parse the HTML (nothing runs) and keep the words, never tags. */
const plainText = (html: string): string =>
  (JSDOM.fragment(html).textContent || '').replace(/[<>]/g, '')

/**
 * WordPress importer.
 *
 * Reads a WordPress export file (Tools > Export > All content, a .xml "WXR" file)
 * and brings over authors, categories, tags, media, posts, pages, approved
 * comments and featured images. Old WordPress URLs get redirects to their new
 * address so search rankings carry over.
 *
 * Safe to run more than once: anything that already exists (same slug or email)
 * is skipped rather than duplicated.
 */

export type ImportReport = {
  authors: number
  categories: number
  tags: number
  media: number
  posts: number
  pages: number
  comments: number
  redirects: number
  skipped: number
  errors: string[]
}

type WPItem = Record<string, any>

const ctx = { disableRevalidate: true, isWordPressImport: true }

const asArray = <T>(v: T | T[] | undefined | null): T[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]

const text = (v: unknown): string => {
  if (v === undefined || v === null) return ''
  if (typeof v === 'object' && v && '#text' in (v as any)) return String((v as any)['#text'])
  return String(v)
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `item-${crypto.randomBytes(3).toString('hex')}`

/** Strip WordPress image size suffixes so "photo-300x200.jpg" matches "photo.jpg". */
const baseImageKey = (url: string) => {
  try {
    const u = new URL(url)
    return u.pathname
      .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '')
      .replace(/-scaled(?=\.[a-z0-9]+$)/i, '')
  } catch {
    return url
  }
}

/** A light version of WordPress's wpautop: classic-editor content has no <p> tags. */
const autop = (html: string) => {
  const cleaned = html
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
    .replace(/\[\/?[a-z_-]+[^\]]*\]/gi, '') // drop leftover shortcodes
    .replace(/\r\n/g, '\n')
  if (/<p[\s>]/i.test(cleaned)) return cleaned
  return cleaned
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      /^<(h[1-6]|ul|ol|blockquote|pre|table|figure|div|hr)/i.test(chunk)
        ? chunk
        : `<p>${chunk.replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n')
}

const IMG_TOKEN = 'UPIMG::'

function replaceImagePlaceholders(
  node: any,
  findMedia: (token: string) => number | string | undefined,
  asBlock: boolean,
): any {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node.children)) {
    const out: any[] = []
    for (const child of node.children) {
      const onlyText =
        child?.type === 'paragraph' &&
        Array.isArray(child.children) &&
        child.children.length === 1 &&
        child.children[0]?.type === 'text' &&
        typeof child.children[0].text === 'string' &&
        child.children[0].text.startsWith(IMG_TOKEN)
      if (onlyText) {
        const id = findMedia(child.children[0].text.slice(IMG_TOKEN.length).trim())
        if (id !== undefined) {
          // Posts get a Media block; page columns get an image (upload) node.
          out.push(
            asBlock
              ? {
                  type: 'block',
                  version: 2,
                  format: '',
                  fields: {
                    id: crypto.randomBytes(12).toString('hex'),
                    blockName: '',
                    blockType: 'mediaBlock',
                    media: id,
                  },
                }
              : {
                  type: 'upload',
                  relationTo: 'media',
                  value: id,
                  fields: null,
                  format: '',
                  version: 3,
                },
          )
        }
        continue
      }
      out.push(replaceImagePlaceholders(child, findMedia, asBlock))
    }
    node.children = out
  }
  return node
}

export async function importWordPress({
  xml,
  payload,
  req,
  downloadMedia = true,
}: {
  xml: string
  payload: Payload
  req?: Partial<PayloadRequest>
  downloadMedia?: boolean
}): Promise<ImportReport> {
  const report: ImportReport = {
    authors: 0,
    categories: 0,
    tags: 0,
    media: 0,
    posts: 0,
    pages: 0,
    comments: 0,
    redirects: 0,
    skipped: 0,
    errors: [],
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: true,
    trimValues: false,
    parseTagValue: false,
    isArray: (name) =>
      [
        'item',
        'wp:author',
        'wp:category',
        'wp:tag',
        'wp:postmeta',
        'wp:comment',
        'category',
      ].includes(name),
  })
  const doc = parser.parse(xml)
  const channel = doc?.rss?.channel
  if (!channel) throw new Error('This does not look like a WordPress export file.')

  const siteBase = text(channel['wp:base_blog_url'] || channel.link).replace(/\/$/, '')
  const items: WPItem[] = asArray(channel.item)
  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  const toLexical = (
    html: string,
    findMedia?: (t: string) => number | string | undefined,
    asBlock = true,
  ) => {
    let prepared = autop(html)
    if (findMedia) {
      prepared = prepared.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (_m, src) => {
        return `</p><p>${IMG_TOKEN}${src}</p><p>`
      })
    }
    const state = convertHTMLToLexical({ editorConfig, html: prepared || '<p></p>', JSDOM })
    if (findMedia) replaceImagePlaceholders(state.root, findMedia, asBlock)
    // Remove empty paragraphs left behind by image splitting.
    state.root.children = (state.root.children as any[]).filter(
      (c) => !(c.type === 'paragraph' && Array.isArray(c.children) && c.children.length === 0),
    )
    if (state.root.children.length === 0) {
      ;(state.root.children as any[]).push({
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        textFormat: 0,
        textStyle: '',
      })
    }
    return state
  }

  const opts = { req, context: ctx, overrideAccess: true } as const

  // ---------- Authors ----------
  const authorIds = new Map<string, number | string>()
  for (const a of asArray(channel['wp:author'])) {
    const login = text(a['wp:author_login'])
    const email = text(a['wp:author_email']).toLowerCase()
    const name = text(a['wp:author_display_name']) || login
    if (!login) continue
    try {
      const fallbackEmail = email || `${slugify(login)}@imported.invalid`
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: fallbackEmail } },
        limit: 1,
        depth: 0,
        ...opts,
      })
      if (existing.docs[0]) {
        authorIds.set(login, existing.docs[0].id)
        report.skipped++
        continue
      }
      const user = await payload.create({
        collection: 'users',
        data: {
          email: fallbackEmail,
          name,
          role: 'author',
          // Random password: imported authors reset it with "Forgot password".
          password: crypto.randomBytes(24).toString('base64url'),
        } as any,
        ...opts,
      })
      authorIds.set(login, user.id)
      report.authors++
    } catch (e) {
      report.errors.push(`Author ${login}: ${(e as Error).message}`)
    }
  }

  // ---------- Categories & tags ----------
  const categoryIds = new Map<string, number | string>()
  const tagIds = new Map<string, number | string>()

  const ensureTerm = async (
    collection: 'categories' | 'tags',
    slug: string,
    title: string,
    map: Map<string, number | string>,
    description?: string,
  ) => {
    if (!slug || map.has(slug)) return map.get(slug)
    const existing = await payload.find({
      collection,
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...opts,
    })
    if (existing.docs[0]) {
      map.set(slug, existing.docs[0].id)
      return existing.docs[0].id
    }
    const created = await payload.create({
      collection,
      data: {
        title: title || slug,
        slug,
        ...(collection === 'categories' && description ? { description } : {}),
      } as any,
      ...opts,
    })
    map.set(slug, created.id)
    if (collection === 'categories') report.categories++
    else report.tags++
    return created.id
  }

  for (const c of asArray(channel['wp:category'])) {
    try {
      await ensureTerm(
        'categories',
        text(c['wp:category_nicename']),
        text(c['wp:cat_name']),
        categoryIds,
        text(c['wp:category_description']),
      )
    } catch (e) {
      report.errors.push(`Category: ${(e as Error).message}`)
    }
  }
  for (const t of asArray(channel['wp:tag'])) {
    try {
      await ensureTerm('tags', text(t['wp:tag_slug']), text(t['wp:tag_name']), tagIds)
    } catch (e) {
      report.errors.push(`Tag: ${(e as Error).message}`)
    }
  }

  // ---------- Media ----------
  const mediaByWpId = new Map<string, number | string>()
  const mediaByKey = new Map<string, number | string>()

  const uploadFromURL = async (url: string, alt: string): Promise<number | string | undefined> => {
    const key = baseImageKey(url)
    if (mediaByKey.has(key)) return mediaByKey.get(key)
    if (!downloadMedia) return undefined
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = Buffer.from(await res.arrayBuffer())
    const name = decodeURIComponent(path.basename(new URL(url).pathname)) || 'file'
    const mimetype = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: name } },
      limit: 1,
      depth: 0,
      ...opts,
    })
    const doc =
      existing.docs[0] ||
      (await payload.create({
        collection: 'media',
        data: { alt } as any,
        file: { data, mimetype, name, size: data.length },
        ...opts,
      }))
    if (!existing.docs[0]) report.media++
    mediaByKey.set(key, doc.id)
    return doc.id
  }

  for (const item of items.filter((i) => text(i['wp:post_type']) === 'attachment')) {
    const url = text(item['wp:attachment_url'])
    if (!url) continue
    try {
      const id = await uploadFromURL(url, text(item.title))
      if (id !== undefined) mediaByWpId.set(text(item['wp:post_id']), id)
    } catch (e) {
      report.errors.push(`Media ${url}: ${(e as Error).message}`)
    }
  }

  const findMedia = (src: string) => {
    const key = baseImageKey(src)
    return mediaByKey.get(key)
  }

  // Images used in content that were not listed as attachments.
  const contentItems = items.filter((i) => ['post', 'page'].includes(text(i['wp:post_type'])))
  for (const item of contentItems) {
    const html = text(item['content:encoded'])
    for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src = m[1]
      if (!findMedia(src) && /^https?:\/\//.test(src)) {
        try {
          await uploadFromURL(src, '')
        } catch (e) {
          report.errors.push(`Image ${src}: ${(e as Error).message}`)
        }
      }
    }
  }

  // ---------- Posts & pages ----------
  const wpIdToComments = new Map<number | string, WPItem[]>()

  for (const item of contentItems) {
    const type = text(item['wp:post_type']) as 'post' | 'page'
    const wpStatus = text(item['wp:status'])
    if (['trash', 'auto-draft', 'inherit'].includes(wpStatus)) continue

    const title = text(item.title) || '(no title)'
    const slug = text(item['wp:post_name']) || slugify(title)
    const collection = type === 'post' ? 'posts' : 'pages'

    try {
      const existing = await payload.find({
        collection,
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        draft: true,
        ...opts,
      })
      if (existing.docs[0]) {
        report.skipped++
        continue
      }

      const status = wpStatus === 'publish' || wpStatus === 'future' ? 'published' : 'draft'
      const dateGmt = text(item['wp:post_date_gmt'])
      const publishedAt =
        dateGmt && !dateGmt.startsWith('0000')
          ? new Date(dateGmt.replace(' ', 'T') + 'Z').toISOString()
          : new Date().toISOString()

      const meta: Record<string, string> = {}
      for (const pm of asArray(item['wp:postmeta']))
        meta[text(pm['wp:meta_key'])] = text(pm['wp:meta_value'])
      const heroImage = meta._thumbnail_id ? mediaByWpId.get(meta._thumbnail_id) : undefined

      const content = toLexical(text(item['content:encoded']), findMedia, collection === 'posts')
      const excerpt = plainText(text(item['excerpt:encoded']))
        .trim()
      const seoTitle = meta._yoast_wpseo_title || meta.rank_math_title || ''
      const seoDescription = meta._yoast_wpseo_metadesc || meta.rank_math_description || excerpt

      let created: { id: number | string }
      if (collection === 'posts') {
        const cats: (number | string)[] = []
        const tags: (number | string)[] = []
        for (const c of asArray(item.category)) {
          const domain = typeof c === 'object' ? c['@_domain'] : ''
          const nicename = typeof c === 'object' ? c['@_nicename'] : ''
          const label = text(c)
          if (domain === 'category') {
            const id = await ensureTerm(
              'categories',
              nicename || slugify(label),
              label,
              categoryIds,
            )
            if (id !== undefined) cats.push(id)
          } else if (domain === 'post_tag') {
            const id = await ensureTerm('tags', nicename || slugify(label), label, tagIds)
            if (id !== undefined) tags.push(id)
          }
        }
        const author = authorIds.get(text(item['dc:creator']))
        created = await payload.create({
          collection: 'posts',
          draft: status === 'draft',
          data: {
            title,
            slug,
            content,
            excerpt: excerpt || undefined,
            heroImage,
            categories: cats,
            tags,
            authors: author ? [author] : [],
            sticky: text(item['wp:is_sticky']) === '1',
            allowComments: text(item['wp:comment_status']) !== 'closed',
            publishedAt,
            _status: status,
            meta: {
              title: seoTitle || title,
              description: seoDescription || undefined,
              image: heroImage,
            },
          } as any,
          ...opts,
        })
        report.posts++
        wpIdToComments.set(created.id, asArray(item['wp:comment']))
      } else {
        created = await payload.create({
          collection: 'pages',
          draft: status === 'draft',
          data: {
            title,
            slug,
            hero: {
              type: 'lowImpact',
              richText: toLexical(`<h1>${title.replace(/</g, '&lt;')}</h1>`),
            },
            layout: [
              {
                blockType: 'content',
                columns: [{ size: 'full', richText: content }],
              },
            ],
            publishedAt,
            _status: status,
            meta: {
              title: seoTitle || title,
              description: seoDescription || undefined,
              image: heroImage,
            },
          } as any,
          ...opts,
        })
        report.pages++
      }

      // Redirect the old WordPress address to the new one.
      const oldLink = text(item.link)
      if (oldLink && status === 'published') {
        try {
          const oldPath =
            new URL(oldLink, siteBase || 'http://localhost').pathname.replace(/\/$/, '') || '/'
          const newPath = collection === 'posts' ? `/posts/${slug}` : `/${slug}`
          const exists =
            (
              await payload.count({
                collection: 'redirects',
                where: { from: { equals: oldPath } },
                ...opts,
              })
            ).totalDocs > 0
          if (!exists && oldPath !== newPath && oldPath !== '/' && !oldPath.startsWith('/?')) {
            await payload.create({
              collection: 'redirects',
              data: {
                from: oldPath,
                type: '301',
                to: { type: 'reference', reference: { relationTo: collection, value: created.id } },
              } as any,
              ...opts,
            })
            report.redirects++
          }
        } catch (e) {
          report.errors.push(`Redirect for ${slug}: ${(e as Error).message}`)
        }
      }
    } catch (e) {
      report.errors.push(`${type} "${title}": ${(e as Error).message}`)
    }
  }

  // ---------- Comments ----------
  for (const [postId, comments] of wpIdToComments) {
    const wpToNew = new Map<string, number | string>()
    const sorted = [...comments].sort(
      (a, b) => Number(text(a['wp:comment_id'])) - Number(text(b['wp:comment_id'])),
    )
    for (const c of sorted) {
      if (text(c['wp:comment_approved']) !== '1') continue
      if (text(c['wp:comment_type']) && text(c['wp:comment_type']) !== 'comment') continue
      try {
        const parentWp = text(c['wp:comment_parent'])
        const created = await payload.create({
          collection: 'comments',
          data: {
            post: postId,
            parent: parentWp && parentWp !== '0' ? wpToNew.get(parentWp) : undefined,
            authorName: text(c['wp:comment_author']) || 'Anonymous',
            authorEmail: text(c['wp:comment_author_email']) || 'unknown@imported.invalid',
            content:
              plainText(text(c['wp:comment_content']))
                .slice(0, 5000) || '(empty)',
            status: 'approved',
          } as any,
          ...opts,
        })
        wpToNew.set(text(c['wp:comment_id']), created.id)
        report.comments++
      } catch (e) {
        report.errors.push(`Comment: ${(e as Error).message}`)
      }
    }
  }

  return report
}
