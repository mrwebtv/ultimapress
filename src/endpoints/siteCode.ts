import { spawn } from 'child_process'
import type { Endpoint, PayloadRequest } from 'payload'
import { Readable } from 'stream'

import { hasRole } from '../access/roles'
import {
  checkDeployKey,
  clearStaged,
  createDeployKey,
  deployKeyInfo,
  readStaged,
  saveUpload,
  siteCodeAvailable,
  stageUpload,
  supervisor,
} from '../siteCode/supervisor'
import { getServerSideURL } from '../utilities/getURL'

/**
 * Site code: download this site's code, change it with Claude, put it live.
 * Everything here is for administrators only, and anything that changes the
 * running site asks for the administrator's password again.
 */
const MAX_UPLOAD = 150 * 1024 * 1024

const json = (body: unknown, status = 200) => Response.json(body, { status })
const unavailable = () =>
  json({ error: 'Site code updates work on a site installed with Docker (the Hostinger button or install.sh).' }, 400)

const admin = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? req.user : null)
const who = (req: PayloadRequest) => (req.user as { email?: string } | null)?.email || 'admin'

/** True when `password` is the logged-in administrator's password. */
async function passwordOk(req: PayloadRequest, password: unknown): Promise<boolean> {
  const email = (req.user as { email?: string } | null)?.email
  if (!email || typeof password !== 'string' || !password) return false
  try {
    await req.payload.login({ collection: 'users', data: { email, password } })
    return true
  } catch {
    return false
  }
}

const body = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    return ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

const tooBig = () =>
  json(
    {
      error:
        'That file is too large. Zip the site folder without node_modules and .next, or ask Claude to "put it live", which leaves them out.',
    },
    413,
  )

/** GET /api/site-code/status */
const status: Endpoint = {
  path: '/site-code/status',
  method: 'get',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (!siteCodeAvailable()) return json({ available: false })
    const s = await supervisor('/status').catch(() => null)
    if (!s?.ok) return json({ available: false })
    const staged = readStaged()
    return json({
      available: true,
      site: getServerSideURL(),
      ...s.data,
      staged: staged ? { name: staged.name, size: staged.size, at: staged.at } : null,
      deployKey: deployKeyInfo(),
    })
  },
}

/** GET /api/site-code/download: the code of the version that is live, as a zip. */
const download: Endpoint = {
  path: '/site-code/download',
  method: 'get',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    const exclude = [
      'node_modules/*',
      '.next/*',
      '.git/*',
      'data/*',
      'media/*',
      'backups/*',
      'public/media/*',
      'test-results/*',
      'playwright-report/*',
      '.env',
      '.env.*',
      '.ultimapress-deploy.json',
      '*.zip',
      '*.tgz',
      'tsconfig.tsbuildinfo',
    ]
    const zip = spawn('zip', ['-r', '-q', '-', '.', '-x', ...exclude], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const failed = await new Promise<boolean>((resolve) => {
      zip.once('error', () => resolve(true))
      zip.once('spawn', () => resolve(false))
    })
    if (failed) return json({ error: 'The zip tool is missing on this server.' }, 500)
    const day = new Date().toISOString().slice(0, 10)
    return new Response(Readable.toWeb(zip.stdout) as ReadableStream, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="my-ultimapress-site-${day}.zip"`,
        'cache-control': 'no-store',
      },
    })
  },
}

/**
 * POST /api/site-code/upload (form: file, password)
 * - Logged-in administrator with their password: builds it and puts it live.
 * - Deploy key (x-up-deploy-key header), used by `pnpm ship` in Claude Code:
 *   the update is kept waiting until the administrator confirms it in the admin.
 */
const upload: Endpoint = {
  path: '/site-code/upload',
  method: 'post',
  handler: async (req) => {
    if (!siteCodeAvailable()) return unavailable()
    const deployKey = req.headers.get('x-up-deploy-key') || ''
    const byKey = deployKey.startsWith('up_deploy_') && checkDeployKey(deployKey)
    if (deployKey && !byKey) {
      return json({ error: 'This deploy key is not valid. Create a new one in Build > Site code.' }, 401)
    }
    if (!byKey && !admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD) return tooBig()

    const form = await req.formData?.().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File) || !/\.(zip|tgz|tar\.gz)$/i.test(file.name)) {
      return json({ error: 'Choose a .zip of your site folder.' }, 400)
    }
    if (file.size > MAX_UPLOAD) return tooBig()

    if (byKey) {
      stageUpload(await saveUpload(file))
      return json({
        staged: true,
        message: 'Sent. Open Site code in your admin and confirm with your password to put it live.',
        confirmAt: `${getServerSideURL()}/admin/site-code`,
      })
    }

    if (!(await passwordOk(req, form?.get('password')))) return json({ error: 'Wrong password.' }, 403)
    const saved = await saveUpload(file)
    const res = await supervisor('/deploy', { file: saved.file, by: who(req), note: saved.name })
    return json(res.data, res.status)
  },
}

/** POST /api/site-code/deploy { password }: puts the update sent by Claude live. */
const deploy: Endpoint = {
  path: '/site-code/deploy',
  method: 'post',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (!siteCodeAvailable()) return unavailable()
    const data = await body(req)
    if (!(await passwordOk(req, data.password))) return json({ error: 'Wrong password.' }, 403)
    const staged = readStaged()
    if (!staged) return json({ error: 'There is no update waiting.' }, 400)
    const res = await supervisor('/deploy', { file: staged.file, by: who(req), note: 'Sent by Claude' })
    if (res.ok) clearStaged()
    return json(res.data, res.status)
  },
}

/** POST /api/site-code/discard { password }: throws away the update sent by Claude. */
const discard: Endpoint = {
  path: '/site-code/discard',
  method: 'post',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (!siteCodeAvailable()) return unavailable()
    clearStaged(true)
    return json({ ok: true })
  },
}

/** POST /api/site-code/revert { password, to: 'previous' | 'official', restoreData? } */
const revert: Endpoint = {
  path: '/site-code/revert',
  method: 'post',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (!siteCodeAvailable()) return unavailable()
    const data = await body(req)
    if (!(await passwordOk(req, data.password))) return json({ error: 'Wrong password.' }, 403)
    const res = await supervisor('/revert', {
      to: data.to === 'official' ? 'official' : 'previous',
      restoreData: data.restoreData === true,
      by: who(req),
    })
    return json(res.data, res.status)
  },
}

/** POST /api/site-code/key { password }: a new deploy key (the old one stops working). */
const key: Endpoint = {
  path: '/site-code/key',
  method: 'post',
  handler: async (req) => {
    if (!admin(req)) return json({ error: 'Administrators only.' }, 401)
    if (!siteCodeAvailable()) return unavailable()
    const data = await body(req)
    if (!(await passwordOk(req, data.password))) return json({ error: 'Wrong password.' }, 403)
    return json({ key: createDeployKey(), site: getServerSideURL() })
  },
}

export const siteCodeEndpoints: Endpoint[] = [status, download, upload, deploy, discard, revert, key]
