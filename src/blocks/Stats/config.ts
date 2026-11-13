import type { Block } from 'payload'

/** A band of two to four headline numbers, e.g. "12 years", "4,000 happy customers". */
export const Stats: Block = {
  slug: 'stats',
  interfaceName: 'StatsBlock',
  labels: { singular: 'Numbers', plural: 'Numbers' },
  fields: [
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 4,
      fields: [
        { name: 'value', type: 'text', required: true, admin: { description: 'e.g. 12 or 4,000+' } },
        { name: 'label', type: 'text', required: true, admin: { description: 'e.g. years in Dublin' } },
      ],
    },
  ],
}
