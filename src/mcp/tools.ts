import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { JSDOM } from 'jsdom'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import sharp from 'sharp'


/**
 * Friendly tools for Claude: write posts and pages from plain HTML instead of the
 * editor's internal format. They act as the connected user, with that user's role.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)

async function toRichText(req: PayloadRequest, html: string) {
  const editorConfig = await editorConfigFactory.default({ config: req.payload.config })
  return convertHTMLToLexical({ editorConfig, html: html || '<p></p>', JSDOM })
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] })

async function termIds(
  req: PayloadRequest,
  collection: 'categories' | 'tags',
  names: string[] | undefined,
) {
  const ids: (number | string)[] = []
  for (const name of names || []) {
    const slug = slugify(name)
    if (!slug) continue
    const found = await req.payload.find({
      collection,
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      req,
      overrideAccess: false,
    })
    const doc =
      found.docs[0] ||
      (await req.payload.create({
        collection,
        data: { title: name, slug } as never,
        req,
        overrideAccess: false,
      }))
    ids.push(doc.id)
  }
  return ids
}

type Tool = NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]

// ---- addImage: fetch a picture from the web into the media library ----

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
const MAX_IMAGE_BYTES = 12 * 1024 * 1024

/** True for addresses that must never be fetched: this server, private networks, link-local. */
function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  if (v === 6) {
    const x = ip.toLowerCase()
    if (x.startsWith('::ffff:')) return isPrivateAddress(x.slice(7))
    return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff')
  }
  return true
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('That is not a valid web address.')
  }
  if (url.protocol !== 'https:') throw new Error('The image address must start with https://')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error('That website could not be found. Check the address.')
      })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error('That address is not on the public internet.')
  }
  return url
}

async function downloadImage(raw: string): Promise<{ data: Buffer; mimetype: string }> {
  let url = await assertPublicUrl(raw)
  let res: Response | undefined
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    })
    const next = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && next) {
      url = await assertPublicUrl(new URL(next, url).toString())
      continue
    }
    break
  }
  if (!res || !res.ok) throw new Error(`The image could not be downloaded (status ${res?.status}).`)
  const mimetype = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!IMAGE_TYPES[mimetype]) {
    throw new Error('That address is not a JPEG, PNG, WebP, GIF or AVIF image. Use the direct address of the picture itself, not of a web page.')
  }
  const chunks: Buffer[] = []
  let size = 0
  const reader = res.body?.getReader()
  if (!reader) throw new Error('The image came back empty.')
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      throw new Error('That image is larger than 12 MB.')
    }
    chunks.push(Buffer.from(value))
  }
  if (!size) throw new Error('The image came back empty.')
  return { data: Buffer.concat(chunks), mimetype }
}

export const ultimaPressTools: Tool[] = [
  {
    name: 'writePost',
    description:
      'Create a blog post from HTML (headings, paragraphs, lists, links, bold, quotes). Categories and tags are created if they do not exist. Saves as a draft unless publish is true.',
    parameters: {
      title: z.string().describe('Post title'),
      html: z.string().describe('The post body as HTML'),
      excerpt: z.string().optional().describe('One or two sentence summary'),
      categories: z.array(z.string()).optional().describe('Category names'),
      tags: z.array(z.string()).optional().describe('Tag names'),
      publish: z.boolean().optional().describe('true to publish now, otherwise a draft'),
    },
    handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
      const a = args as {
        title: string
        html: string
        excerpt?: string
        categories?: string[]
        tags?: string[]
        publish?: boolean
      }
      const doc = await req.payload.create({
        collection: 'posts',
        draft: !a.publish,
        data: {
          title: a.title,
          slug: slugify(a.title),
          content: await toRichText(req, a.html),
          excerpt: a.excerpt,
          categories: await termIds(req, 'categories', a.categories),
          tags: await termIds(req, 'tags', a.tags),
          authors: req.user ? [req.user.id] : [],
          _status: a.publish ? 'published' : 'draft',
          meta: { title: a.title, description: a.excerpt },
        } as never,
        req,
        overrideAccess: false,
      })
      return text(
        `${a.publish ? 'Published' : 'Saved as a draft'}: "${a.title}" (id ${doc.id}). Edit it at /admin/collections/posts/${doc.id}`,
      )
    },
  },
  {
    name: 'writePage',
    description:
      'Create a website page from HTML. The page gets a title hero and one full-width content section. Saves as a draft unless publish is true. Use findPages/updatePages to change existing pages or add other blocks.',
    parameters: {
      title: z.string().describe('Page title, shown in the hero'),
      html: z.string().describe('The page body as HTML'),
      slug: z.string().optional().describe('Address of the page, e.g. "about" for /about'),
      description: z.string().optional().describe('SEO description'),
      publish: z.boolean().optional().describe('true to publish now, otherwise a draft'),
    },
    handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
      const a = args as {
        title: string
        html: string
        slug?: string
        description?: string
        publish?: boolean
      }
      const slug = slugify(a.slug || a.title)
      const doc = await req.payload.create({
        collection: 'pages',
        draft: !a.publish,
        data: {
          title: a.title,
          slug,
          hero: {
            type: 'lowImpact',
            richText: await toRichText(req, `<h1>${a.title.replace(/</g, '&lt;')}</h1>`),
          },
          layout: [
            {
              blockType: 'content',
              columns: [{ size: 'full', richText: await toRichText(req, a.html) }],
            },
          ],
          _status: a.publish ? 'published' : 'draft',
          meta: { title: a.title, description: a.description },
        } as never,
        req,
        overrideAccess: false,
      })
      return text(
        `${a.publish ? 'Published' : 'Saved as a draft'}: "${a.title}" at /${slug} (id ${doc.id}). Edit it at /admin/collections/pages/${doc.id}`,
      )
    },
  },
  {
    name: 'addImage',
    description:
      'Add a picture to the media library from a direct https image address (JPEG, PNG, WebP, GIF or AVIF, up to 12 MB). Returns the image id to use in hero.media, mediaBlock, gallery, testimonials photos, the site logo and SEO images, plus a small preview so you can check it shows what you expected. Only use pictures the owner is allowed to use, such as free stock photos.',
    parameters: {
      url: z.string().describe('Direct https address of the image file itself'),
      alt: z.string().describe('What the picture shows, for screen readers and search engines'),
    },
    handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
      const a = args as { url: string; alt: string }
      try {
        const { data, mimetype } = await downloadImage(a.url)
        const name = `${slugify(a.alt).slice(0, 60) || 'image'}.${IMAGE_TYPES[mimetype]}`
        const doc = await req.payload.create({
          collection: 'media',
          data: { alt: a.alt } as never,
          file: { data, mimetype, name, size: data.byteLength },
          req,
          overrideAccess: false,
        })
        const content: (
          | { type: 'text'; text: string }
          | { type: 'image'; data: string; mimeType: string }
        )[] = [
          {
            type: 'text',
            text: `Added "${a.alt}" to the media library (id ${doc.id}, ${(doc as { width?: number }).width || '?'} x ${(doc as { height?: number }).height || '?'} px). Use the id wherever an image field is asked for, and this address in a designed section: ${(doc as { url?: string }).url}`,
          },
        ]
        try {
          const preview = await sharp(data).rotate().resize({ width: 360 }).jpeg({ quality: 60 }).toBuffer()
          content.push({ type: 'image', data: preview.toString('base64'), mimeType: 'image/jpeg' })
        } catch {
          // A missing preview is not a failure: the image itself is saved.
        }
        // The plugin's types only describe text results; the server passes images through as they are.
        return { content } as unknown as ReturnType<typeof text>
      } catch (err) {
        return text(`The image was not added. ${err instanceof Error ? err.message : 'Unknown error.'}`)
      }
    },
  },
]

export const ultimaPressInstructions = `You are connected to an UltimaPress website (a WordPress alternative).

How the site is put together
- Pages are a hero plus blocks in "layout". Read a page with findPages before changing it, and keep blocks you are not changing.
- The "design" block (a designed section) holds HTML and CSS that you write yourself. Its CSS only applies inside that section; scripts, forms and iframes are removed. This is how you design pages to a professional standard.
- The other blocks are ready-made: features, split (image and text), stats, gallery, pricing, testimonials, faq, cta, content, mediaBlock, formBlock (a real working form from the forms collection), embed (video or map), archive (latest posts). Use them for simple pages, for forms, and when the owner wants to edit sections in the admin without code.
- Give every block a short blockName such as "services". It becomes the anchor, so "#services" (or "/#services" from the menu) scrolls to it.
- Site-wide settings live in site-settings (siteTitle, tagline, template, primaryColor, accentColor, headingFont, bodyFont). The header global holds the menu and a highlighted "button"; the footer holds links, about, phone, email, address, hours and social links.
- For an article or a plain text page, writePost and writePage take HTML.

When asked for a homepage, a landing page or a website, design it like a premium agency would for a paying client. This is the standard to meet, not a draft:
1. Photos first. Add 6 to 12 strong, on-topic photos with addImage and check each preview. Replace anything weak, off-topic or showing a brand logo. addImage returns the image address to use in your HTML.
2. Build the page from design blocks, one per section (hero, services, story, prices, gallery, FAQ, booking...), so each can be changed on its own later. Set the page hero type to "none"; your first design block is the hero.
3. Aim for a site that would win a design award, not a tidy template. Pick one bold visual idea for the business and carry it through every section. Use real photography full-bleed and large, oversized display type (the hero headline can fill the screen), confident contrast between light and dark sections, asymmetric and overlapping layouts, layered images, and details people remember: a scrolling marquee of services, a numbered process, a striking price list. Load display and body fonts with an @import from fonts.googleapis.com at the top of the CSS. Avoid the generic template look: no identical card grids everywhere, no emoji as icons (use inline SVG).
3b. Add motion with CSS only: an entrance animation on the hero (headline and image easing in), reveals as sections scroll into view using animation-timeline: view() inside @supports (animation-timeline: view()), hover states on every link, card and image, and a gentle infinite marquee where it fits. Keep it smooth and wrap all motion in @media (prefers-reduced-motion: no-preference).
4. Write plain semantic HTML with your own class names and put all styling in the CSS field. Make every section responsive with media queries and check it works at phone width. Interactions must work without JavaScript (details and summary for an FAQ, CSS for hover).
5. Copy: specific to the business and short. No filler. Never invent reviews, ratings or statistics; leave them out unless the owner gives them.
6. Links: buttons go to anchors on the page or to pages that exist. For booking or contact, add a formBlock with a form from the forms collection (create the form if needed, with short fields at width 50 side by side) right after a designed section that introduces it, and point the buttons at its anchor.
7. Make it theirs: set siteTitle, tagline, colours and fonts in site-settings to match your design, fill the header menu and button, and fill the footer with the about line, contact details and hours.
8. Fill meta.title, meta.description and meta.image, then publish if asked.
9. Finish by telling the owner what you built, the address to look at, and every placeholder detail (prices, phone, address, hours) they need to correct.

Rules
- Save new content as drafts unless the person asks you to publish.
- Use real details the owner gives you.
- You cannot add new kinds of features (new collections or code) through this connection; for that the person uses Claude Code on the site's code.`
