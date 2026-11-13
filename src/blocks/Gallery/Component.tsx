import React from 'react'

import type { GalleryBlock as Props } from '@/payload-types'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/ui'

const cols: Record<string, string> = {
  '2': 'grid-cols-2',
  '3': 'grid-cols-2 md:grid-cols-3',
  '4': 'grid-cols-2 md:grid-cols-4',
}

export const GalleryBlock: React.FC<Props> = ({ heading, images, columns }) => {
  // Pick a grid the photos fill exactly, so there is never a lone photo at the end.
  const n = (images || []).length
  let grid = columns || '3'
  let feature = false
  if (n >= 5 && n % 4 === 1) {
    grid = '4'
    feature = true
  } else if (n >= 6 && n % 3 === 0) {
    grid = '3'
    feature = true
  } else if (n % 4 === 0) grid = '4'
  else if (n % 3 === 0) grid = '3'
  else if (n % 2 === 0) grid = '2'
  return (
    <section className="container">
      {heading && (
        <h2 className="mb-10 text-center text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          {heading}
        </h2>
      )}
      <div className={cn('grid gap-4', cols[grid])}>
        {(images || []).map((img, i) =>
          img && typeof img === 'object' ? (
            <Media
              key={i}
              resource={img}
              className={cn(
                'overflow-hidden rounded-[var(--radius)] shadow-sm',
                feature && i === 0
                  ? 'col-span-2 row-span-2 aspect-square'
                  : 'aspect-square',
              )}
              imgClassName="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              size="(max-width: 768px) 50vw, 33vw"
            />
          ) : null,
        )}
      </div>
    </section>
  )
}
