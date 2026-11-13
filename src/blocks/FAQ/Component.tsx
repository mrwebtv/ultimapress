import React from 'react'

import type { FAQBlock as Props } from '@/payload-types'

/** Renders as native <details> for accessibility, plus FAQPage schema for search engines. */
export const FAQBlock: React.FC<Props> = ({ heading, items }) => {
  const list = items || []
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  }

  return (
    <section className="container">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        {heading && (
          <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl lg:sticky lg:top-24 lg:self-start">
            {heading}
          </h2>
        )}
        <div className="flex flex-col gap-3">
          {list.map((item, i) => (
            <details
              key={i}
              className="group rounded-[var(--radius)] border border-border bg-card px-6 py-5 transition open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {item.question}
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none transition-transform group-open:rotate-45"
                  style={{
                    background: 'color-mix(in oklab, var(--up-primary) 12%, transparent)',
                    color: 'var(--up-primary)',
                  }}
                >
                  +
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
    </section>
  )
}
