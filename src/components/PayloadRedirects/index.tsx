import type React from 'react'
import type { Page, Post } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getCachedRedirects } from '@/utilities/getRedirects'
import { notFound, redirect } from 'next/navigation'

interface Props {
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()

  // Match with or without a trailing slash, as WordPress links usually end in "/".
  const normalise = (u: string) => (u.length > 1 ? u.replace(/\/+$/, '') : u)
  const redirectItem = redirects.find((redirect) => normalise(redirect.from) === normalise(url))

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    let redirectUrl: string

    if (
      typeof redirectItem.to?.reference?.value === 'string' ||
      typeof redirectItem.to?.reference?.value === 'number'
    ) {
      const collection = redirectItem.to?.reference?.relationTo
      const id = redirectItem.to?.reference?.value

      const payload = await getPayload({ config: configPromise })
      const document = (await payload
        .findByID({ collection, id, depth: 0, select: { slug: true } })
        .catch(() => null)) as Page | Post | null
      redirectUrl = `${redirectItem.to?.reference?.relationTo !== 'pages' ? `/${redirectItem.to?.reference?.relationTo}` : ''}/${
        document?.slug
      }`
    } else {
      redirectUrl = `${redirectItem.to?.reference?.relationTo !== 'pages' ? `/${redirectItem.to?.reference?.relationTo}` : ''}/${
        typeof redirectItem.to?.reference?.value === 'object'
          ? redirectItem.to?.reference?.value?.slug
          : ''
      }`
    }

    if (redirectUrl) redirect(redirectUrl)
  }

  if (disableNotFound) return null

  notFound()
}
