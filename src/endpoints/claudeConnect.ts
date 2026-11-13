import type { Endpoint } from 'payload'
import crypto from 'crypto'

import { hasRole } from '../access/roles'
import { getServerSideURL } from '../utilities/getURL'

/** Every operation the MCP plugin allows, so the connection can do whatever the user's role allows. */
const collectionOps = {
  pages: { find: true, create: true, update: true, delete: true },
  posts: { find: true, create: true, update: true, delete: true },
  categories: { find: true, create: true, update: true, delete: true },
  tags: { find: true, create: true, update: true, delete: true },
  comments: { find: true, update: true, delete: true },
  media: { find: true, update: true },
  redirects: { find: true, create: true, update: true, delete: true },
  forms: { find: true, create: true, update: true, delete: true },
  formSubmissions: { find: true },
}
const globalOps = {
  siteSettings: { find: true, update: true },
  header: { find: true, update: true },
  footer: { find: true, update: true },
}

/**
 * POST /api/claude-connect
 * Creates a Claude connection for the logged-in user and returns its address once.
 * The connection acts as that user, so Claude can only do what their role allows.
 */
export const claudeConnectEndpoint: Endpoint = {
  path: '/claude-connect',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (!user || !hasRole(user, 'admin', 'editor', 'author')) {
      return Response.json({ error: 'Log in first.' }, { status: 401 })
    }

    const key = `up_${crypto.randomBytes(24).toString('base64url')}`
    const created = new Date().toISOString().slice(0, 10)

    await req.payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      req,
      data: {
        user: user.id,
        label: `Claude (${created})`,
        description: 'Created from Dashboard > Build with Claude',
        enableAPIKey: true,
        apiKey: key,
        ...collectionOps,
        ...globalOps,
        // Our own writePost / writePage / addImage tools
        'payload-mcp-tool': { writePost: true, writePage: true, addImage: true },
      } as never,
    })

    const site = getServerSideURL()
    const url = `${site}/api/mcp?key=${key}`
    return Response.json({
      url,
      claudeCode: `claude mcp add --transport http ultimapress "${url}"`,
      https: site.startsWith('https://'),
    })
  },
}
