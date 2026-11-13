import type { Block } from 'payload'

export const Embed: Block = {
  slug: 'embed',
  interfaceName: 'EmbedBlock',
  labels: { singular: 'Embed (YouTube, Vimeo, Maps)', plural: 'Embeds' },
  fields: [
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: {
        description:
          'Paste a YouTube, Vimeo, Loom or Google Maps embed link. It renders automatically.',
      },
    },
    { name: 'caption', type: 'text' },
  ],
}
