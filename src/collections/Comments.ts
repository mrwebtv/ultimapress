import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { revalidatePath } from 'next/cache'

import { isAdminOrEditor, hasRole } from '../access/roles'

/**
 * Comments with moderation, like WordPress's Discussion settings.
 * Anyone can submit through the public API; new comments are held for
 * approval when "Hold new comments for approval" is on in Site Settings.
 */
export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    useAsTitle: 'authorName',
    defaultColumns: ['authorName', 'post', 'status', 'createdAt'],
    group: 'Grow',
  },
  access: {
    create: () => true,
    read: ({ req: { user } }) => {
      if (hasRole(user, 'admin', 'editor', 'author')) return true
      return { status: { equals: 'approved' } }
    },
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      index: true,
    },
    {
      name: 'parent',
      label: 'Reply to',
      type: 'relationship',
      relationTo: 'comments',
      admin: { description: 'Set when this comment is a reply.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'authorName', label: 'Name', type: 'text', required: true, maxLength: 80 },
        {
          name: 'authorEmail',
          label: 'Email',
          type: 'email',
          required: true,
          access: {
            // Emails are never shown publicly.
            read: ({ req: { user } }) => Boolean(user),
          },
        },
      ],
    },
    { name: 'content', type: 'textarea', required: true, maxLength: 5000 },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      required: true,
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Spam', value: 'spam' },
      ],
      admin: { position: 'sidebar' },
      access: {
        create: ({ req: { user } }) => hasRole(user, 'admin', 'editor'),
        update: ({ req: { user } }) => hasRole(user, 'admin', 'editor'),
      },
    },
  ],
  hooks: {
    afterChange: [
      // Refresh the post page so approved comments show up straight away.
      async ({ doc, req }) => {
        if (req.context.disableRevalidate) return doc
        try {
          const postId = typeof doc.post === 'object' ? doc.post.id : doc.post
          const post = await req.payload.findByID({
            collection: 'posts',
            id: postId,
            depth: 0,
            req,
            select: { slug: true },
          })
          if (post?.slug) revalidatePath(`/posts/${post.slug}`)
        } catch {
          // Revalidation is best effort.
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || req.context.isWordPressImport) return data

        const settings = await req.payload.findGlobal({ slug: 'site-settings', req })
        if (settings.enableComments === false) {
          throw new APIError('Comments are turned off on this site.', 403, null, true)
        }

        // Honeypot: the public form has a hidden "website" field that only bots fill in.
        const body = (req.data || {}) as Record<string, unknown>
        if (body.website) {
          data.status = 'spam'
          return data
        }

        if (!hasRole(req.user, 'admin', 'editor')) {
          data.status = settings.moderateComments === false ? 'approved' : 'pending'
        }
        return data
      },
    ],
  },
  timestamps: true,
}
