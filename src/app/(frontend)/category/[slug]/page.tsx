import type { Metadata } from 'next'
import React, { cache } from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import { PostArchivePage } from '@/components/PostArchivePage'

export const revalidate = 600

type Args = { params: Promise<{ slug: string }> }

const find = cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'categories',
    where: { slug: { equals: decodeURIComponent(slug) } },
    limit: 1,
    depth: 0,
  })
  return docs[0] || null
})

export default async function Page({ params }: Args) {
  const { slug } = await params
  const term = await find(slug)
  if (!term) notFound()
  return (
    <PostArchivePage
      label="Category"
      title={term.title}
      description={'description' in term ? (term.description as string | null) : null}
      where={{ categories: { contains: term.id } }}
    />
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const term = await find(slug)
  return { title: term ? `Category: ${term.title}` : 'Category' }
}
