import React from 'react'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import { notFound } from 'next/navigation'

import { CollectionArchive } from '@/components/CollectionArchive'
import { getSiteSettings } from '@/utilities/getSiteSettings'

/** Shared archive page for categories, tags and authors. */
export async function PostArchivePage({
  label,
  title,
  description,
  where,
}: {
  label: string
  title: string
  description?: string | null
  where: Where
}) {
  const settings = await getSiteSettings()
  if (settings.enableBlog === false) notFound()

  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: settings.postsPerPage || 12,
    overrideAccess: false,
    sort: ['-sticky', '-publishedAt'],
    where: { and: [{ _status: { equals: 'published' } }, where] },
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container mb-12">
        <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
        <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
        {description && <p className="mt-4 text-lg text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {posts.docs.length > 0 ? (
        <CollectionArchive posts={posts.docs} />
      ) : (
        <p className="container text-muted-foreground">No posts yet.</p>
      )}
    </div>
  )
}
