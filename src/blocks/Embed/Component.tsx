import React from 'react'

import type { EmbedBlock as Props } from '@/payload-types'

/** Turns a pasted link into a safe embed URL, like WordPress's oEmbed. */
export const toEmbedURL = (raw: string): string | null => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  // Exact domains only, so a look-alike such as "evilyoutube.com" is never embedded.
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`)
  const safeId = (id?: string | null) => (id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null)

  if (host === 'youtu.be') {
    const id = safeId(url.pathname.slice(1))
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (is('youtube.com')) {
    const id = safeId(
      url.searchParams.get('v') || url.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/)?.[2],
    )
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (is('vimeo.com')) {
    const id = url.pathname.match(/(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  if (is('loom.com')) {
    const id = safeId(url.pathname.match(/\/(share|embed)\/([^/?]+)/)?.[2])
    return id ? `https://www.loom.com/embed/${id}` : null
  }
  if ((host === 'google.com' || host === 'www.google.com') && url.pathname.startsWith('/maps/embed')) {
    return `https://www.google.com${url.pathname}${url.search}`
  }
  return null
}

export const EmbedBlock: React.FC<Props> = ({ url, caption }) => {
  const src = url ? toEmbedURL(url) : null
  if (!src) return null
  return (
    <figure className="container max-w-4xl">
      <div className="relative w-full overflow-hidden rounded-[var(--radius)] aspect-video bg-card">
        <iframe
          src={src}
          title={caption || 'Embedded content'}
          className="absolute inset-0 w-full h-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  )
}
