import { NextResponse, type NextRequest } from 'next/server'

/**
 * Site-wide redirects (Redirects collection), including old WordPress
 * addresses like /2024/05/my-post/ created by the importer.
 * The list is cached in memory for a minute so pages stay fast.
 */

type RedirectDoc = {
  from: string
  type?: '301' | '302' | '307' | '308' | null
  to?: {
    type?: 'reference' | 'custom' | null
    url?: string | null
    reference?: {
      relationTo: 'pages' | 'posts'
      value: { slug?: string | null } | number | string
    } | null
  } | null
}

const normalise = (u: string) => (u.length > 1 ? u.replace(/\/+$/, '') : u)

let cache: { at: number; map: Map<string, { to: string; status: number }> } | null = null

async function loadRedirects(): Promise<Map<string, { to: string; status: number }>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map
  const map = new Map<string, { to: string; status: number }>()
  try {
    const port = process.env.PORT || '3000'
    const res = await fetch(`http://127.0.0.1:${port}/api/redirects?limit=0&depth=1`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const { docs } = (await res.json()) as { docs: RedirectDoc[] }
      for (const r of docs) {
        let to: string | null = null
        if (r.to?.type === 'custom' && r.to.url) to = r.to.url
        const ref = r.to?.reference
        if (!to && ref && typeof ref.value === 'object' && ref.value?.slug) {
          to = ref.relationTo === 'posts' ? `/posts/${ref.value.slug}` : `/${ref.value.slug}`
        }
        if (to && r.from) map.set(normalise(r.from), { to, status: Number(r.type) || 301 })
      }
    }
  } catch {
    // Redirects are best effort; never break the page.
  }
  cache = { at: Date.now(), map }
  return map
}

const THEME_COOKIE = 'payload-theme'

export async function proxy(request: NextRequest) {
  // Admin: dark mode is the default until the owner picks Bright in the menu.
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (request.cookies.has(THEME_COOKIE)) return NextResponse.next()
    request.cookies.set(THEME_COOKIE, 'dark')
    const res = NextResponse.next({ request: { headers: request.headers } })
    res.cookies.set(THEME_COOKIE, 'dark', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  }

  const path = normalise(request.nextUrl.pathname)
  const map = await loadRedirects()
  const hit = map.get(path)
  if (hit && normalise(hit.to) !== path) {
    return NextResponse.redirect(new URL(hit.to, request.url), hit.status)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/((?!api|admin|_next|next/|favicon|.*\\.(?:xml|txt|ico|png|jpg|jpeg|svg|webp|avif|gif|css|js|woff2?)$).*)',
  ],
}
