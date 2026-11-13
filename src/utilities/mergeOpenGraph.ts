import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Built with UltimaPress.',
  images: [
    {
      url: `${getServerSideURL()}/og-default.webp`,
    },
  ],
  siteName: 'UltimaPress',
  title: 'UltimaPress',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
