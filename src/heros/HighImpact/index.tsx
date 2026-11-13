'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'

export const HighImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  // The photo is cropped around its focal point (set on the image in Media).
  const photo = media && typeof media === 'object' ? media : null
  const focal = `${photo?.focalX ?? 50}% ${photo?.focalY ?? 50}%`

  return (
    <div
      className="relative -mt-[10.4rem] flex items-center justify-center text-white"
      data-theme="dark"
    >
      <div className="container relative z-10 flex items-center justify-center pb-16 pt-44">
        <div className="max-w-3xl md:text-center">
          {richText && (
            <RichText
              className="mb-8 [&_h1]:!mb-6 [&_h1]:!text-5xl [&_h1]:!font-bold [&_h1]:!leading-[1.05] [&_h1]:!tracking-tight md:[&_h1]:!text-7xl [&_p]:!text-lg [&_p]:text-white/90 md:[&_p]:!text-xl"
              data={richText}
              enableGutter={false}
            />
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex flex-wrap gap-4 md:justify-center">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink size="lg" {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <div
        className="min-h-[86vh] select-none"
        style={{ '--up-focal': focal } as React.CSSProperties}
      >
        {photo && (
          <Media
            fill
            imgClassName="-z-10 object-cover [object-position:var(--up-focal)]"
            priority
            resource={photo}
          />
        )}
        {/* A soft dark layer so the headline stays readable over any photo. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/65" />
      </div>
    </div>
  )
}
