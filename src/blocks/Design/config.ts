import type { Block, FieldAccess } from 'payload'

import { hasRole } from '@/access/roles'
import { cleanDesignHtml } from '@/utilities/designSafety'

const editorsOnly: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin', 'editor')

/**
 * A section designed from scratch in HTML and CSS, usually by connected Claude.
 * The CSS only affects this section, and scripts are removed.
 */
export const Design: Block = {
  slug: 'design',
  interfaceName: 'DesignBlock',
  labels: { singular: 'Designed section', plural: 'Designed sections' },
  fields: [
    {
      name: 'html',
      label: 'HTML',
      type: 'code',
      required: true,
      admin: {
        language: 'html',
        description: "The section's content. Scripts, forms and embedded frames are removed.",
      },
      access: { create: editorsOnly, update: editorsOnly },
      hooks: { beforeChange: [({ value }) => cleanDesignHtml(value)] },
    },
    {
      name: 'css',
      label: 'CSS',
      type: 'code',
      admin: {
        language: 'css',
        description:
          'Styles for this section only. Write normal CSS; it is limited to this section automatically.',
      },
      access: { create: editorsOnly, update: editorsOnly },
    },
    {
      name: 'fullWidth',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Run edge to edge. Untick to keep it inside the page width.' },
    },
  ],
}
