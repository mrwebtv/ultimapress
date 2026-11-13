import type { GlobalConfig } from 'payload'
import { revalidateTag } from 'next/cache'

import { isAdmin } from '../access/roles'

export const FONT_OPTIONS = [
  'Inter',
  'Manrope',
  'DM Sans',
  'Plus Jakarta Sans',
  'Outfit',
  'Space Grotesk',
  'Playfair Display',
  'Cormorant Garamond',
  'Fraunces',
  'Lora',
  'Merriweather',
  'Archivo',
] as const

export const TEMPLATE_OPTIONS = [
  { label: 'Luxury editorial', value: 'editorial' },
  { label: 'Modern bright', value: 'bright' },
  { label: 'Dark premium', value: 'dark' },
  { label: 'Swiss bold', value: 'swiss' },
]

/**
 * Site Settings: the UltimaPress equivalent of WordPress's General, Reading,
 * Discussion and Customizer screens, in one place.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'siteTitle', type: 'text', defaultValue: 'My UltimaPress Site', required: true },
            { name: 'tagline', type: 'text', defaultValue: 'Just another UltimaPress site' },
            {
              type: 'row',
              fields: [
                { name: 'logo', type: 'upload', relationTo: 'media' },
                {
                  name: 'siteIcon',
                  label: 'Site icon (favicon)',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { description: 'Square image, 512 x 512 px recommended.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'language', type: 'text', defaultValue: 'en', admin: { width: '33%' } },
                {
                  name: 'timezone',
                  type: 'text',
                  defaultValue: 'UTC',
                  admin: { width: '33%', description: 'e.g. Europe/Dublin' },
                },
                {
                  name: 'dateFormat',
                  type: 'select',
                  defaultValue: 'long',
                  admin: { width: '33%' },
                  options: [
                    { label: 'November 11, 2026', value: 'long' },
                    { label: '11/11/2026', value: 'numeric' },
                    { label: '2026-11-11', value: 'iso' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Design',
          fields: [
            {
              name: 'template',
              type: 'select',
              defaultValue: 'bright',
              required: true,
              options: TEMPLATE_OPTIONS,
              admin: { description: 'Switch the look of the whole site in one click.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'primaryColor',
                  type: 'text',
                  defaultValue: '#7B2BFF',
                  admin: { width: '50%', description: 'Buttons and links, as a hex colour.' },
                },
                {
                  name: 'accentColor',
                  type: 'text',
                  defaultValue: '#F21CD9',
                  admin: { width: '50%', description: 'Highlights, as a hex colour.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'headingFont',
                  type: 'select',
                  defaultValue: 'Manrope',
                  options: FONT_OPTIONS.map((f) => ({ label: f, value: f })),
                  admin: { width: '50%' },
                },
                {
                  name: 'bodyFont',
                  type: 'select',
                  defaultValue: 'Inter',
                  options: FONT_OPTIONS.map((f) => ({ label: f, value: f })),
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'customCSS',
              label: 'Additional CSS',
              type: 'code',
              admin: { language: 'css' },
            },
          ],
        },
        {
          label: 'Reading',
          fields: [
            {
              name: 'homepageDisplays',
              label: 'Your homepage displays',
              type: 'radio',
              defaultValue: 'page',
              options: [
                { label: 'A static page', value: 'page' },
                { label: 'Your latest posts', value: 'posts' },
              ],
            },
            {
              name: 'homepage',
              type: 'relationship',
              relationTo: 'pages',
              admin: {
                condition: (_, siblingData) => siblingData?.homepageDisplays === 'page',
                description: 'Leave empty to use the page with the slug "home".',
              },
            },
            { name: 'postsPerPage', type: 'number', defaultValue: 12, min: 1, max: 100 },
            {
              name: 'discourageSearchEngines',
              label: 'Discourage search engines from indexing this site',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
        {
          label: 'Features',
          description:
            'Turn features on and off. Everything here is built in, no plugins to install or update.',
          fields: [
            { name: 'enableBlog', label: 'Blog', type: 'checkbox', defaultValue: true },
            { name: 'enableComments', label: 'Comments', type: 'checkbox', defaultValue: true },
            {
              name: 'moderateComments',
              label: 'Hold new comments for approval',
              type: 'checkbox',
              defaultValue: true,
              admin: { condition: (_, s) => Boolean(s?.enableComments) },
            },
            { name: 'enableSearch', label: 'Site search', type: 'checkbox', defaultValue: true },
            { name: 'enableRSS', label: 'RSS feed', type: 'checkbox', defaultValue: true },
            {
              name: 'enableThemeSwitcher',
              label: 'Light / dark switcher in the footer',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
        {
          label: 'Maintenance',
          fields: [
            {
              name: 'maintenanceMode',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Visitors see a holding page. Logged-in users see the site.' },
            },
            {
              name: 'maintenanceMessage',
              type: 'textarea',
              defaultValue: 'We are making some improvements. Back very soon.',
            },
          ],
        },
        {
          label: 'Privacy',
          fields: [
            {
              name: 'privacyPolicyPage',
              type: 'relationship',
              relationTo: 'pages',
              admin: { description: 'Linked in the footer and on comment forms.' },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, req: { payload, context } }) => {
        if (!context.disableRevalidate) {
          payload.logger.info('Revalidating site settings')
          revalidateTag('global_site-settings', 'max')
        }
        return doc
      },
    ],
  },
}
