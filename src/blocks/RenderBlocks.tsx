import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { FeaturesBlock } from '@/blocks/Features/Component'
import { PricingBlock } from '@/blocks/Pricing/Component'
import { TestimonialsBlock } from '@/blocks/Testimonials/Component'
import { GalleryBlock } from '@/blocks/Gallery/Component'
import { FAQBlock } from '@/blocks/FAQ/Component'
import { EmbedBlock } from '@/blocks/Embed/Component'
import { SplitBlock } from '@/blocks/Split/Component'
import { DesignBlock } from '@/blocks/Design/Component'
import { StatsBlock } from '@/blocks/Stats/Component'

const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  features: FeaturesBlock,
  pricing: PricingBlock,
  testimonials: TestimonialsBlock,
  gallery: GalleryBlock,
  faq: FAQBlock,
  embed: EmbedBlock,
  split: SplitBlock,
  design: DesignBlock,
  stats: StatsBlock,
}

/** Some blocks sit on a full-width band so a long page has rhythm instead of one white column. */
const bands: Record<string, React.CSSProperties> = {
  features: { background: 'color-mix(in oklab, var(--up-primary) 6%, var(--background))' },
  testimonials: { background: 'color-mix(in oklab, var(--up-accent) 7%, var(--background))' },
  stats: { background: 'var(--up-primary)' },
}

/** A block's name doubles as its anchor, so a link to "#services" scrolls to it. */
const anchor = (name?: string | null) =>
  name
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || undefined

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return (
                <div
                  className={
                    blockType === 'design'
                      ? 'scroll-mt-24'
                      : blockType in bands
                        ? 'scroll-mt-24 py-16 md:py-24'
                        : 'my-16 scroll-mt-24 md:my-24'
                  }
                  id={anchor(block.blockName)}
                  key={index}
                  style={bands[blockType]}
                >
                  {/* @ts-expect-error there may be some mismatch between the expected types here */}
                  <Block {...block} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
