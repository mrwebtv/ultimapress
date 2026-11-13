import { getServerSideURL } from '@/utilities/getURL'

/** Sitemap index pointing at the pages and posts sitemaps. */
export async function GET() {
  const site = getServerSideURL()
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${site}/pages-sitemap.xml</loc></sitemap><sitemap><loc>${site}/posts-sitemap.xml</loc></sitemap></sitemapindex>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
