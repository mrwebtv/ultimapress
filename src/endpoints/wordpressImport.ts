import type { Endpoint } from 'payload'

import { hasRole } from '../access/roles'
import { importWordPress } from '../importer/wordpress'

/**
 * POST /api/wp-import  (administrators only)
 * Body: multipart form with a "file" field holding the WordPress export (.xml).
 */
export const wordpressImportEndpoint: Endpoint = {
  path: '/wp-import',
  method: 'post',
  handler: async (req) => {
    if (!hasRole(req.user, 'admin')) {
      return Response.json({ error: 'Only administrators can import.' }, { status: 403 })
    }
    try {
      const form = await req.formData?.()
      const file = form?.get('file')
      if (!file || typeof file === 'string') {
        return Response.json({ error: 'Attach your WordPress export file (.xml).' }, { status: 400 })
      }
      const xml = await (file as Blob).text()
      const downloadMedia = form?.get('downloadMedia') !== 'false'
      const report = await importWordPress({ xml, payload: req.payload, req, downloadMedia })
      return Response.json(report)
    } catch (e) {
      req.payload.logger.error(e)
      return Response.json({ error: (e as Error).message }, { status: 500 })
    }
  },
}

/**
 * GET /api/site-export  (administrators only)
 * Downloads all content as one JSON file: pages, posts, categories, tags,
 * comments, menus and settings. Media files are covered by the backup script.
 */
export const siteExportEndpoint: Endpoint = {
  path: '/site-export',
  method: 'get',
  handler: async (req) => {
    if (!hasRole(req.user, 'admin')) {
      return Response.json({ error: 'Only administrators can export.' }, { status: 403 })
    }
    const p = req.payload
    const all = async (collection: 'pages' | 'posts' | 'categories' | 'tags' | 'comments' | 'media' | 'redirects') =>
      (await p.find({ collection, limit: 0, pagination: false, depth: 0, draft: true, req, overrideAccess: true })).docs
    const data = {
      exportedAt: new Date().toISOString(),
      generator: 'UltimaPress',
      pages: await all('pages'),
      posts: await all('posts'),
      categories: await all('categories'),
      tags: await all('tags'),
      comments: await all('comments'),
      media: await all('media'),
      redirects: await all('redirects'),
      header: await p.findGlobal({ slug: 'header', depth: 0 }),
      footer: await p.findGlobal({ slug: 'footer', depth: 0 }),
      siteSettings: await p.findGlobal({ slug: 'site-settings', depth: 0 }),
    }
    const date = new Date().toISOString().slice(0, 10)
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ultimapress-export-${date}.json"`,
      },
    })
  },
}
