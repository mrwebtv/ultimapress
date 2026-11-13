import { getServerSideURL } from '@/utilities/getURL'
import { getSiteSettings } from '@/utilities/getSiteSettings'

/** robots.txt, honouring "Discourage search engines" in Site Settings > Reading. */
export async function GET() {
  const settings = await getSiteSettings()
  const site = getServerSideURL()
  const body = settings.discourageSearchEngines
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${site}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
