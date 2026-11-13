import React from 'react'

import type { StatsBlock as Props } from '@/payload-types'
import { cn } from '@/utilities/ui'

export const StatsBlock: React.FC<Props> = ({ items }) => {
  const list = items || []
  return (
    <section className="container">
      <div
        className={cn(
          'grid gap-8 text-center text-white',
          list.length === 2 && 'grid-cols-2',
          list.length === 3 && 'grid-cols-1 sm:grid-cols-3',
          list.length >= 4 && 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {list.map((s, i) => (
          <div key={i}>
            <div className="up-heading text-4xl font-bold tracking-tight md:text-6xl">{s.value}</div>
            <div className="mt-2 text-base text-white/80 md:text-lg">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
