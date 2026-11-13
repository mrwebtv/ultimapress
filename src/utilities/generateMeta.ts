import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/og-default.webp'

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url

    url = ogUrl ? serverUrl + ogUrl : serverUrl + image.url
  }

  return url
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  // The site name is appended by the title template in the root layout.
  const title = doc?.meta?.title || doc?.title || undefined
  // The homepage keeps the layout's default "Site title | Tagline".
  const isHome = doc?.slug === 'home'

  return {
    ...(doc?.meta?.description ? { description: doc.meta.description } : {}),
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      ...(title ? { title } : {}),
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    ...(title && !isHome ? { title } : {}),
  }
}
