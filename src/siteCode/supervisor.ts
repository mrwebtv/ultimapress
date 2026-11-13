import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * Talks to the supervisor (docker/supervisor.mjs), the small program that runs the
 * site in Docker and can replace its code. Outside Docker (pnpm dev) there is no
 * supervisor and `siteCodeAvailable()` is false.
 */
const url = () => process.env.UP_SUPERVISOR_URL || ''
export const siteCodeDir = () => process.env.UP_SITE_CODE_DIR || ''
export const siteCodeAvailable = () => Boolean(url() && siteCodeDir())

export async function supervisor(
  pathname: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${url()}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-up-token': process.env.UP_SUPERVISOR_TOKEN || '', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

// ---- Deploy key: lets Claude Code send an update, which then waits for the owner's password.

const keyFile = () => path.join(siteCodeDir(), 'deploy-key.json')
const hash = (key: string) => crypto.createHash('sha256').update(key).digest('hex')

export function createDeployKey(): string {
  const key = `up_deploy_${crypto.randomBytes(24).toString('base64url')}`
  fs.writeFileSync(keyFile(), JSON.stringify({ hash: hash(key), createdAt: new Date().toISOString() }), {
    mode: 0o600,
  })
  return key
}

export function deployKeyInfo(): { createdAt: string } | null {
  try {
    const { createdAt } = JSON.parse(fs.readFileSync(keyFile(), 'utf8'))
    return { createdAt }
  } catch {
    return null
  }
}

export function checkDeployKey(key: string): boolean {
  try {
    const saved = JSON.parse(fs.readFileSync(keyFile(), 'utf8')).hash as string
    const given = hash(key)
    return saved.length === given.length && crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(given))
  } catch {
    return false
  }
}

// ---- An update sent by Claude Code, waiting for the owner to put it live.

export type Staged = { file: string; name: string; size: number; at: string }
const stagedFile = () => path.join(siteCodeDir(), 'staged.json')

export function readStaged(): Staged | null {
  try {
    const s = JSON.parse(fs.readFileSync(stagedFile(), 'utf8')) as Staged
    return fs.existsSync(s.file) ? s : null
  } catch {
    return null
  }
}

export function clearStaged(removeFile = false) {
  const s = readStaged()
  if (removeFile && s) fs.rmSync(s.file, { force: true })
  fs.rmSync(stagedFile(), { force: true })
}

/** Saves an uploaded archive in the incoming folder and returns its path. */
export async function saveUpload(file: File): Promise<{ file: string; name: string; size: number }> {
  const ext = /\.zip$/i.test(file.name) ? '.zip' : '.tgz'
  const dir = path.join(siteCodeDir(), 'incoming')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()))
  return { file: dest, name: file.name, size: file.size }
}

export function stageUpload(saved: { file: string; name: string; size: number }) {
  clearStaged(true)
  fs.writeFileSync(stagedFile(), JSON.stringify({ ...saved, at: new Date().toISOString() }))
}
