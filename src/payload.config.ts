import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Tags } from './collections/Tags'
import { Comments } from './collections/Comments'
import { SiteSettings } from './globals/SiteSettings'
import { siteExportEndpoint, wordpressImportEndpoint } from './endpoints/wordpressImport'
import { claudeConnectEndpoint } from './endpoints/claudeConnect'
import { siteCodeEndpoints } from './endpoints/siteCode'
import { refreshAfterClaude, siteRefreshEndpoint } from './endpoints/siteRefresh'
import { migrations } from './migrations'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    // Built-in avatar icon: no calls to Gravatar.
    avatar: 'default',
    meta: {
      titleSuffix: '- UltimaPress',
      description: 'The admin for your UltimaPress website.',
      openGraph: { siteName: 'UltimaPress', description: 'The admin for your UltimaPress website.' },
      icons: [
        { rel: 'icon', url: '/favicon.ico' },
        { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
      ],
    },
    components: {
      graphics: {
        Logo: '@/components/admin/Logo',
        Icon: '@/components/admin/Icon',
      },
      beforeLogin: ['@/components/BeforeLogin'],
      // The Spine: UltimaPress's menu (src/components/admin/Spine)
      Nav: '@/components/admin/Spine#Spine',
      beforeDashboard: ['@/components/BeforeDashboard'],
      views: {
        // "Build a feature": its own page, linked from the Spine
        buildFeature: {
          Component: '@/components/admin/BuildFeature#BuildFeatureView',
          path: '/build-a-feature',
          // Without a title here the browser tab would say "Payload"
          meta: { title: 'Build a feature', openGraph: { title: 'Build a feature' } },
        },
        // "Site code": download the site's code, change it with Claude, put it live
        siteCode: {
          Component: '@/components/admin/SiteCode#SiteCodeView',
          path: '/site-code',
          meta: { title: 'Site code', openGraph: { title: 'Site code' } },
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Database changes ship as migrations and run automatically when the site starts.
    prodMigrations: migrations,
  }),
  collections: [Pages, Posts, Media, Categories, Tags, Comments, Users],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [SiteSettings, Header, Footer],
  endpoints: [
    wordpressImportEndpoint,
    siteExportEndpoint,
    claudeConnectEndpoint,
    siteRefreshEndpoint,
    ...siteCodeEndpoints,
  ],
  // Last, so it also covers collections that other plugins add.
  plugins: [...plugins, refreshAfterClaude],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  // Email (password resets, form notifications). Set SMTP_* in .env to send real email;
  // without it, emails are written to the server log.
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'no-reply@example.com',
        defaultFromName: process.env.SMTP_FROM_NAME || 'UltimaPress',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        },
      })
    : undefined,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
