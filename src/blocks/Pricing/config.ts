import type { Block } from 'payload'

import { link } from '../../fields/link'

export const Pricing: Block = {
  slug: 'pricing',
  interfaceName: 'PricingBlock',
  labels: { singular: 'Pricing table', plural: 'Pricing tables' },
  fields: [
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text' },
    { name: 'intro', type: 'textarea' },
    {
      name: 'plans',
      type: 'array',
      minRows: 1,
      maxRows: 4,
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'price', type: 'text', required: true, admin: { description: 'e.g. €49' } },
            { name: 'period', type: 'text', admin: { description: 'e.g. /month' } },
          ],
        },
        { name: 'description', type: 'textarea' },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'feature', type: 'text', required: true }],
        },
        { name: 'highlighted', label: 'Highlight this plan', type: 'checkbox' },
        link({ appearances: false }),
      ],
    },
  ],
}
