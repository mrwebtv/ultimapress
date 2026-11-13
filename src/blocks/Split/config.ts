import type { Block } from 'payload'

/** A photo beside a heading, text, a short list and a button: the staple of a business page. */
export const Split: Block = {
  slug: 'split',
  interfaceName: 'SplitBlock',
  labels: { singular: 'Image and text', plural: 'Image and text' },
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'right',
      options: [
        { label: 'Image on the right', value: 'right' },
        { label: 'Image on the left', value: 'left' },
      ],
    },
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'text', type: 'textarea' },
    {
      name: 'bullets',
      type: 'array',
      maxRows: 6,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      name: 'button',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'url', type: 'text', admin: { description: 'e.g. /contact or #prices' } },
      ],
    },
  ],
}
