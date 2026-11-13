import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { ultimaPressInstructions, ultimaPressTools } from '@/mcp/tools'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title || ''
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  // Lets Claude work on the site's content and settings (Dashboard > Build with Claude).
  // Each connection is an API key that acts as the user who created it, with that user's role.
  mcpPlugin({
    collections: {
      pages: {
        enabled: true,
        description:
          'Website pages. Content is built from blocks in the "layout" field; the hero sits above it.',
      },
      posts: { enabled: true, description: 'Blog posts, with categories, tags and an excerpt.' },
      categories: { enabled: true, description: 'Blog categories.' },
      tags: { enabled: true, description: 'Blog tags.' },
      comments: {
        enabled: { find: true, update: true, delete: true },
        description: 'Reader comments. Set status to approved, pending or spam to moderate.',
      },
      media: {
        enabled: { find: true, update: true },
        description:
          'Images and files. Use their IDs in pages, posts and settings. Add new pictures with addImage.',
      },
      redirects: { enabled: true, description: 'Redirects from old addresses to new ones.' },
      forms: { enabled: true, description: 'Forms built with the form builder.' },
      'form-submissions': { enabled: { find: true }, description: 'Entries sent through forms.' },
    },
    globals: {
      'site-settings': {
        enabled: true,
        description:
          'Site title, tagline, template (bright, editorial, dark, swiss), colours, fonts, homepage, features and maintenance mode.',
      },
      header: { enabled: true, description: 'Header menu links, with optional sub-menus.' },
      footer: { enabled: true, description: 'Footer menu links.' },
    },
    mcp: {
      tools: ultimaPressTools,
      serverOptions: {
        serverInfo: { name: 'UltimaPress', version: '1.0.0' },
        instructions: ultimaPressInstructions,
      },
    },
    // Accept the key in the address (?key=...) as well as an "Authorization: Bearer" header,
    // because the Claude app connects with a URL only.
    overrideAuth: async (req, getDefaultMcpAccessSettings) => {
      let key: string | null = null
      try {
        key = new URL(req.url || '', 'http://localhost').searchParams.get('key')
      } catch {
        key = null
      }
      return getDefaultMcpAccessSettings(key || undefined)
    },
    overrideApiKeyCollection: (collection) => ({
      ...collection,
      labels: { singular: 'Claude connection', plural: 'Claude connections' },
      admin: {
        ...collection.admin,
        group: 'Build',
        description:
          'Each connection lets Claude work on this site as the person who created it. Delete one to disconnect it.',
      },
    }),
  }),
  redirectsPlugin({
    collections: ['pages', 'posts'],
    redirectTypes: ['301', '302'],
    redirectTypeFieldOverride: {
      defaultValue: '301',
      admin: { description: '301 = permanent (best for SEO), 302 = temporary.' },
    },
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description:
                  'The old address, e.g. /2024/05/my-old-post. Takes effect within a minute.',
              },
            }
          }
          return field
        })
      },
      admin: {
        group: 'Grow',
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      admin: { group: 'Grow' },
    },
    formOverrides: {
      admin: { group: 'Grow' },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  searchPlugin({
    collections: ['posts'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      admin: { group: 'Grow' },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
]
