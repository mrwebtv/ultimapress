import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
  /** Logo image from Site Settings. Falls back to the site title as text. */
  src?: string | null
  siteTitle?: string | null
}

export const Logo = (props: Props) => {
  const { loading = 'lazy', priority = 'low', className, src, siteTitle } = props

  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        alt={siteTitle || 'Logo'}
        loading={loading}
        fetchPriority={priority}
        decoding="async"
        className={clsx('max-w-[11rem] w-auto h-9 object-contain', className)}
        src={src}
      />
    )
  }

  return (
    <span className={clsx('up-heading text-xl font-bold tracking-tight', className)}>
      {siteTitle || 'UltimaPress'}
    </span>
  )
}
