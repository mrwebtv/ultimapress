import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'

export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  return (
    <div className="container">
      <div
        className="relative overflow-hidden rounded-[calc(var(--radius)*2)] px-6 py-16 text-center text-white md:px-16 md:py-24"
        style={{
          background:
            'linear-gradient(135deg, var(--up-primary), color-mix(in oklab, var(--up-primary) 55%, var(--up-accent)))',
        }}
      >
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-2xl">
          {richText && (
            <RichText
              className="mb-8 [&_*]:!text-white [&_h2]:!mb-4 [&_h2]:!text-3xl [&_h2]:!leading-tight md:[&_h2]:!text-5xl [&_p]:!text-lg [&_p]:opacity-90"
              data={richText}
              enableGutter={false}
            />
          )}
          <div className="flex flex-wrap justify-center gap-4">
            {(links || []).map(({ link }, i) => (
              <CMSLink
                key={i}
                {...link}
                appearance="inline"
                className={
                  i === 0
                    ? 'inline-flex items-center justify-center rounded-[var(--radius)] bg-white px-7 py-3.5 text-base font-semibold !text-[var(--up-primary)] shadow-lg transition hover:-translate-y-0.5'
                    : 'inline-flex items-center justify-center rounded-[var(--radius)] border border-white/60 px-7 py-3.5 text-base font-semibold !text-white transition hover:bg-white/10'
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
