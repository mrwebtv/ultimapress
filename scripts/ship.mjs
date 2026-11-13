#!/usr/bin/env node
/**
 * Send this folder to your UltimaPress site ("put it live").
 *
 *   First time:  node scripts/ship.mjs --site https://your-site.com --key up_deploy_...
 *                (the line shown in your admin under Build > Site code)
 *   After that:  pnpm ship
 *
 * The update then waits in your admin: open Site code and confirm it with your
 * password. Nothing goes live before that. Plain Node, no packages needed.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configFile = path.join(root, '.ultimapress-deploy.json')
const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

let config = {}
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
} catch {
  /* first run */
}
const site = (arg('site') || config.site || '').replace(/\/$/, '')
const key = arg('key') || config.key || ''
if (!site || !key) {
  console.error(
    'No site set up yet. In your admin, open Build > Site code, create a deploy key and run the line it shows.',
  )
  process.exit(1)
}
if (arg('site') || arg('key')) {
  fs.writeFileSync(configFile, JSON.stringify({ site, key }, null, 2))
  console.log('Saved your site and deploy key in .ultimapress-deploy.json (keep that file private).')
}

// Top-level names that never leave this computer. (Filtered here rather than with
// tar patterns, so it behaves the same on Windows, macOS and Linux.)
const SKIP = new Set([
  'node_modules',
  '.next',
  '.git',
  'data',
  'media',
  'backups',
  'test-results',
  'playwright-report',
  '.ultimapress-deploy.json',
  'tsconfig.tsbuildinfo',
])
const entries = fs
  .readdirSync(root)
  .filter((name) => !SKIP.has(name))
  .filter((name) => !/^\.env(\..+)?$/.test(name) || name === '.env.example')
  .filter((name) => !/\.(zip|tgz)$/i.test(name))

const archiveName = `ultimapress-${Date.now()}.tgz`
const archive = path.join(os.tmpdir(), archiveName)

console.log('Packing your site…')
// The archive is named relative to the temp folder: some tar versions read "C:\..." as a host name.
const tar = spawnSync(
  'tar',
  ['-czf', archiveName, '--exclude', 'public/media', '--exclude', './public/media', '-C', root, ...entries],
  { stdio: 'inherit', cwd: os.tmpdir() },
)
if (tar.status !== 0) {
  console.error('Could not pack the folder (the "tar" command failed).')
  process.exit(1)
}

const size = (fs.statSync(archive).size / 1024 / 1024).toFixed(1)
console.log(`Sending ${size} MB to ${site}…`)
try {
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(archive)]), 'site.tgz')
  const res = await fetch(`${site}/api/site-code/upload`, {
    method: 'POST',
    headers: { 'x-up-deploy-key': key },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `The site answered ${res.status}.`)
  console.log(data.message || 'Sent.')
  if (data.confirmAt) console.log(`Confirm here: ${data.confirmAt}`)
} catch (e) {
  console.error(`Could not send the update: ${e.message}`)
  process.exitCode = 1
} finally {
  fs.rmSync(archive, { force: true })
}
