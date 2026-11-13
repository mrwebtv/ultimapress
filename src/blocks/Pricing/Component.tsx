import React from 'react'
import { Check } from 'lucide-react'

import type { PricingBlock as Props } from '@/payload-types'
import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/ui'
import { SectionHeader } from '../Features/Component'

export const PricingBlock: React.FC<Props> = ({ eyebrow, heading, intro, plans }) => {
  const count = plans?.length || 1
  return (
    <section className="container">
      <SectionHeader eyebrow={eyebrow} heading={heading} intro={intro} />
      <div
        className={cn(
          'grid gap-6 items-stretch',
          count === 2 && 'md:grid-cols-2 max-w-4xl mx-auto',
          count === 3 && 'md:grid-cols-3',
          count >= 4 && 'md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {(plans || []).map((plan, i) => (
          <div
            key={i}
            className={cn(
              'relative flex flex-col rounded-[var(--radius)] border bg-card p-8 transition duration-300 hover:shadow-xl',
              plan.highlighted
                ? 'border-2 border-[var(--up-primary)] shadow-2xl md:-my-3 md:py-11'
                : 'border-border',
            )}
          >
            {plan.highlighted && (
              <span
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white"
                style={{ background: 'var(--up-primary)' }}
              >
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
            <p className="mb-4">
              <span className="up-heading text-4xl font-bold tracking-tight md:text-5xl">{plan.price}</span>
              {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
            </p>
            {plan.description && <p className="text-muted-foreground mb-6">{plan.description}</p>}
            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {(plan.features || []).map((f, j) => (
                <li key={j} className="flex gap-2 items-start">
                  <Check className="w-5 h-5 shrink-0 up-link" />
                  <span>{f.feature}</span>
                </li>
              ))}
            </ul>
            {plan.link?.label && (
              <CMSLink {...plan.link} appearance="inline" className="up-btn w-full" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
