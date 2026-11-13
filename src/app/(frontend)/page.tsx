import type { Metadata } from 'next'

import PageTemplate, { generateMetadata as generatePageMetadata } from './[slug]/page'
import PostsPage from './posts/page'
import { getSiteSettings } from '@/utilities/getSiteSettings'

export const revalidate = 600

/**
 * Homepage. Site Settings > Reading decides whether it shows a static page
 * (the chosen page, or the page with slug "home") or the latest posts.
 */
async function homepageSlug(): Promise<string | 'posts'> {
  const settings = await getSiteSettings()
  if (settings.homepageDisplays === 'posts' && settings.enableBlog !== false) return 'posts'
  const chosen = settings.homepage
  if (chosen && typeof chosen === 'object' && chosen.slug) return chosen.slug
  return 'home'
}

export default async function HomePage() {
  const slug = await homepageSlug()
  if (slug === 'posts') return <PostsPage />
  return <PageTemplate params={Promise.resolve({ slug })} />
}

export async function generateMetadata(): Promise<Metadata> {
  const slug = await homepageSlug()
  if (slug === 'posts') return {}
  return generatePageMetadata({ params: Promise.resolve({ slug }) })
}
