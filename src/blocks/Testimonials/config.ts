import type { Block } from 'payload'

export const Testimonials: Block = {
  slug: 'testimonials',
  interfaceName: 'TestimonialsBlock',
  labels: { singular: 'Testimonials', plural: 'Testimonials' },
  fields: [
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text' },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'quote', type: 'textarea', required: true },
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'role', type: 'text', admin: { description: 'e.g. Owner, Acme Ltd' } },
          ],
        },
        { name: 'photo', type: 'upload', relationTo: 'media' },
        { name: 'rating', type: 'number', min: 1, max: 5 },
      ],
    },
  ],
}
