import React from 'react'

import type { FeaturesBlock as Props } from '@/payload-types'
import { FeatureIcon } from '@/components/Icon'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/ui'

const cols: Record<string, string> = {
  '2': 'md:grid-cols-2',
  '3': 'md:grid-cols-3',
  '4': 'md:grid-cols-2 lg:grid-cols-4',
}

export const FeaturesBlock: React.FC<Props> = ({ eyebrow, heading, intro, columns, items }) => {
  return (
    <section className="container">
      <SectionHeader eyebrow={eyebrow} heading={heading} intro={intro} />
      <div className={cn('grid gap-6 lg:gap-8', cols[columns || '3'])}>
        {(items || []).map((item, i) => {
          const photo = item.image && typeof item.image === 'object' ? item.image : null
          return (
            <div
              key={i}
              className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-background shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              {photo && (
                <Media
                  resource={photo}
                  className="aspect-[4/3] overflow-hidden"
                  imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  size="(max-width: 768px) 100vw, 33vw"
                />
              )}
              <div className="flex flex-1 flex-col p-6 lg:p-7">
                {item.icon && !photo && <FeatureIcon name={item.icon} className="mb-5" />}
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                {item.description && (
                  <p className="leading-relaxed text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export const SectionHeader: React.FC<{
  eyebrow?: string | null
  heading?: string | null
  intro?: string | null
  align?: 'center' | 'left'
}> = ({ eyebrow, heading, intro, align = 'center' }) => {
  if (!eyebrow && !heading && !intro) return null
  return (
    <div className={cn('mb-12 max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <p className="up-link mb-3 text-sm font-semibold uppercase tracking-widest">{eyebrow}</p>
      )}
      {heading && (
        <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          {heading}
        </h2>
      )}
      {intro && <p className="text-lg leading-relaxed text-muted-foreground">{intro}</p>}
    </div>
  )
}
