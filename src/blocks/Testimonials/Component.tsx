import React from 'react'

import type { TestimonialsBlock as Props } from '@/payload-types'
import { Media } from '@/components/Media'
import { SectionHeader } from '../Features/Component'

export const TestimonialsBlock: React.FC<Props> = ({ eyebrow, heading, items }) => {
  return (
    <section className="container">
      <SectionHeader eyebrow={eyebrow} heading={heading} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(items || []).map((t, i) => (
          <figure
            key={i}
            className="rounded-[var(--radius)] border border-border bg-card p-6 flex flex-col gap-4"
          >
            {t.rating ? (
              <div className="up-accent text-lg" aria-label={`${t.rating} out of 5`}>
                {'★'.repeat(t.rating)}
                <span className="opacity-25">{'★'.repeat(5 - t.rating)}</span>
              </div>
            ) : null}
            <blockquote className="text-lg flex-1">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="flex items-center gap-3">
              {t.photo && typeof t.photo === 'object' && (
                <Media
                  resource={t.photo}
                  imgClassName="w-12 h-12 rounded-full object-cover"
                  size="48px"
                />
              )}
              <div>
                <div className="font-semibold">{t.name}</div>
                {t.role && <div className="text-sm text-muted-foreground">{t.role}</div>}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
