import React from 'react'
import { Check } from 'lucide-react'

import type { SplitBlock as Props } from '@/payload-types'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/ui'

export const SplitBlock: React.FC<Props> = ({
  media,
  imagePosition,
  eyebrow,
  heading,
  text,
  bullets,
  button,
}) => {
  const left = imagePosition === 'left'
  return (
    <section className="container">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
        <div className={cn(left && 'md:order-2')}>
          {eyebrow && (
            <p className="up-link mb-3 text-sm font-semibold uppercase tracking-widest">
              {eyebrow}
            </p>
          )}
          <h2 className="mb-5 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            {heading}
          </h2>
          {text && (
            <p className="mb-6 whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
              {text}
            </p>
          )}
          {bullets && bullets.length > 0 && (
            <ul className="mb-8 flex flex-col gap-3">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: 'var(--up-primary)' }}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-lg">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
          {button?.label && button?.url && (
            <a className="up-btn" href={button.url}>
              {button.label}
            </a>
          )}
        </div>
        <div className={cn('relative', left && 'md:order-1')}>
          <div
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-[calc(var(--radius)*2)]',
              left ? '-rotate-3' : 'rotate-3',
            )}
            style={{ background: 'color-mix(in oklab, var(--up-accent) 22%, transparent)' }}
          />
          {media && typeof media === 'object' && (
            <Media
              resource={media}
              className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius)*2)] shadow-2xl"
              imgClassName="h-full w-full object-cover"
              size="(max-width: 768px) 100vw, 50vw"
            />
          )}
        </div>
      </div>
    </section>
  )
}
