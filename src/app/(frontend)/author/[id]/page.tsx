import type { Metadata } from 'next'
import React, { cache } from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import { PostArchivePage } from '@/components/PostArchivePage'

export const revalidate = 600

type Args = { params: Promise<{ id: string }> }

const find = cache(async (id: string) => {
  const payload = await getPayload({ config: configPromise })
  try {
    // Only public fields: name and bio.
    return await payload.findByID({
      collection: 'users',
      id,
      depth: 0,
      overrideAccess: true,
      select: { name: true, bio: true },
    })
  } catch {
    return null
  }
})

export default async function Page({ params }: Args) {
  const { id } = await params
  const author = await find(id)
  if (!author) notFound()
  return (
    <PostArchivePage
      label="Author"
      title={author.name || 'Author'}
      description={author.bio}
      where={{ authors: { contains: author.id } }}
    />
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { id } = await params
  const author = await find(id)
  return { title: author?.name ? `Posts by ${author.name}` : 'Author' }
}
