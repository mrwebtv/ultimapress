#!/usr/bin/env node
/**
 * UltimaPress supervisor.
 *
 * Runs the website and lets the owner replace its code from the admin
 * (Site code page): a new version is unpacked, built and started on a spare
 * port first, and only takes over when it answers. If anything fails the
 * current version keeps running. The database is backed up before every update
 * and restored when a failed update had already changed it.
 *
 * Folders (all on the data volume, so they survive restarts and image updates):
 *   site-code/releases/<id>/   one folder per version: source, node_modules, build
 *   site-code/backups/<id>.dump  database backup taken before <id> went live
 *   site-code/incoming/        uploads waiting to be built
 *   site-code/state.json       which version is live, which one came before
 *   site-code/status.json      progress of the current or last update
 *
 * Plain Node, no dependencies. The app talks to it on 127.0.0.1 only
 * (src/siteCode/supervisor.ts).
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const APP_DIR = path.resolve(process.env.UP_APP_DIR || '/app')
const DATA_DIR = path.resolve(process.env.UP_DATA_DIR || path.join(APP_DIR, 'data'))
const SC = path.join(DATA_DIR, 'site-code')
const RELEASES = path.join(SC, 'releases')
const BACKUPS = path.join(SC, 'backups')
const INCOMING = path.join(SC, 'incoming')
const LOGS = path.join(SC, 'logs')
const STATE_FILE = path.join(SC, 'state.json')
const STATUS_FILE = path.join(SC, 'status.json')

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOSTNAME || '0.0.0.0'
const CONTROL_PORT = Number(process.env.UP_CONTROL_PORT || 3999)
const CANDIDATE_PORT = Number(process.env.UP_CANDIDATE_PORT || 3100)
const TOKEN = crypto.randomBytes(24).toString('hex')
const START_TIMEOUT = Number(process.env.UP_START_TIMEOUT || 180) * 1000

for (const d of [SC, RELEASES, BACKUPS, INCOMING, LOGS]) fs.mkdirSync(d, { recursive: true })

const log = (...a) => console.log('[supervisor]', ...a)
const readJSON = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJSON = (file, value) => {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2))
  fs.renameSync(`${file}.tmp`, file)
}

/** state: { active: id|null, previous: id|null|undefined, releases: {id: {...}}, history: [] } */
let state = readJSON(STATE_FILE, { active: null, releases: {}, history: [] })
const saveState = () => writeJSON(STATE_FILE, state)
const releaseDir = (id) => (id ? path.join(RELEASES, id) : APP_DIR)
const isBuilt = (dir) => fs.existsSync(path.join(dir, '.next', 'BUILD_ID'))
const record = (entry) => {
  state.history = [{ at: new Date().toISOString(), ...entry }, ...(state.history || [])].slice(0, 20)
  saveState()
}

// ---------------------------------------------------------------- the website

const childEnv = (port, host) => ({
  ...process.env,
  PORT: String(port),
  HOSTNAME: host,
  UP_SUPERVISOR_URL: `http://127.0.0.1:${CONTROL_PORT}`,
  UP_SUPERVISOR_TOKEN: TOKEN,
  UP_SITE_CODE_DIR: SC,
})

const startNext = (dir, port, host) =>
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', host], {
    cwd: dir,
    env: childEnv(port, host),
    stdio: 'inherit',
    detached: true,
  })

const stopProcess = (c, wait = 15000) =>
  new Promise((resolve) => {
    if (!c || c.exitCode !== null || c.signalCode !== null) return resolve()
    c.expected = true
    const kill = (sig) => {
      try {
        process.kill(-c.pid, sig)
      } catch {
        try {
          c.kill(sig)
        } catch {
          /* already gone */
        }
      }
    }
    const timer = setTimeout(() => kill('SIGKILL'), wait)
    c.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    kill('SIGTERM')
  })

const waitHealthy = async (port, c, timeout = START_TIMEOUT) => {
  const until = Date.now() + timeout
  let errors = 0
  while (Date.now() < until) {
    if (c && (c.exitCode !== null || c.signalCode !== null)) throw new Error('The site stopped while starting.')
    try {
      const robots = await fetch(`http://127.0.0.1:${port}/robots.txt`, { signal: AbortSignal.timeout(5000) })
      // Up, but every page fails: no point waiting for the full timeout.
      if (robots.status >= 500 && ++errors >= 6) {
        throw new Error(`The admin answered with an error (${robots.status}).`)
      }
      if (robots.ok) {
        // The admin needs the database: this is where new migrations run.
        const admin = await fetch(`http://127.0.0.1:${port}/admin/login`, {
          signal: AbortSignal.timeout(120000),
          redirect: 'manual',
        })
        if (admin.status < 500) return
        throw new Error(`The admin answered with an error (${admin.status}).`)
      }
    } catch (e) {
      if (String(e.message).startsWith('The admin answered')) {
        throw new Error(`The site starts, but its pages fail (error ${e.message.match(/\d+/)?.[0] || '500'}).`)
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('The site did not answer in time.')
}

let main = null
let crashes = []
let shuttingDown = false

const startMain = (id) => {
  const dir = releaseDir(id)
  log(`starting ${id ? `your version ${id}` : 'the official version'} on port ${PORT}`)
  const c = startNext(dir, PORT, HOST)
  main = c
  c.on('exit', (code, signal) => {
    if (c.expected || shuttingDown) return
    log(`the site stopped (${signal || code}), restarting`)
    crashes = [...crashes.filter((t) => Date.now() - t < 120000), Date.now()]
    if (id && crashes.length >= 3) {
      // A custom version that cannot stay up: go back to the official one.
      log('your version keeps stopping: switching back to the official version')
      state.previous = state.active
      state.active = null
      record({ action: 'fallback', id, ok: false, error: 'Stopped three times in two minutes.' })
      crashes = []
      startMain(null)
      return
    }
    setTimeout(() => !shuttingDown && main === c && startMain(id), 2000)
  })
  return c
}

// ---------------------------------------------------------------- update jobs

let job = null // { id, kind, steps, ... } mirrored to status.json
const STEPS = {
  deploy: [
    ['backup', 'Backing up your content'],
    ['unpack', 'Unpacking the new code'],
    ['install', 'Installing what it needs'],
    ['build', 'Building the site'],
    ['check', 'Checking it starts'],
    ['switch', 'Switching over'],
  ],
  revert: [
    ['backup', 'Backing up your content'],
    ['switch', 'Switching over'],
  ],
}
const saveStatus = () => job && writeJSON(STATUS_FILE, job)
const setStep = (key) => {
  for (const s of job.steps) {
    if (s.key === key) s.state = 'running'
    else if (s.state === 'running') s.state = 'done'
  }
  job.step = key
  saveStatus()
  log(`${job.id}: ${key}`)
}
const appendLog = (text) => {
  fs.appendFileSync(job.logFile, text)
  job.log = ((job.log || '') + text).slice(-6000)
}

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    appendLog(`\n$ ${cmd} ${args.join(' ')}\n`)
    const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let tick = 0
    const onData = (d) => {
      appendLog(d.toString())
      if (Date.now() - tick > 1500) {
        tick = Date.now()
        saveStatus()
      }
    }
    c.stdout.on('data', onData)
    c.stderr.on('data', onData)
    const fail = (message) => reject(Object.assign(new Error(message), { fromRun: true }))
    c.on('error', (e) => fail(`${cmd}: ${e.message}`))
    c.on('exit', (code) => (code === 0 ? resolve() : fail(`${cmd} failed (exit ${code}).`)))
  })

/** Replaces a raw command failure with words the owner can act on. */
const plain = (promise, message) =>
  promise.catch((e) => {
    throw e.fromRun ? Object.assign(new Error(message), { code: e.code }) : e
  })

const dbUrl = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set, so the content cannot be backed up.')
  return process.env.DATABASE_URL
}
const backupDatabase = async (id) => {
  const file = path.join(BACKUPS, `${id}.dump`)
  await run('pg_dump', ['-Fc', '--no-owner', '-d', dbUrl(), '-f', file])
  // Keep the five newest backups.
  const old = fs
    .readdirSync(BACKUPS)
    .filter((f) => f.endsWith('.dump'))
    .sort()
    .reverse()
    .slice(5)
  for (const f of old) fs.rmSync(path.join(BACKUPS, f), { force: true })
  return file
}
const restoreDatabase = (file) =>
  run('pg_restore', ['--clean', '--if-exists', '--no-owner', '-d', dbUrl(), file])

const migrationsOf = (dir) => {
  try {
    return fs.readdirSync(path.join(dir, 'src', 'migrations')).sort().join('|')
  } catch {
    return ''
  }
}
const sameFile = (a, b) => {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b))
  } catch {
    return false
  }
}

/** Things an upload must never bring along. */
const STRIP = ['node_modules', '.next', '.git', 'data', 'media', 'backups', 'public/media']

const unpack = async (file, dest) => {
  const tmp = `${dest}.unpack`
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  if (/\.zip$/i.test(file)) await run('unzip', ['-q', '-o', file, '-d', tmp])
  else await run('tar', ['-xzf', file, '-C', tmp, '--no-same-owner'])

  // The site may sit in a single folder inside the archive.
  let root = tmp
  if (!fs.existsSync(path.join(root, 'package.json'))) {
    const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('__'))
    const inner = dirs.find((d) => fs.existsSync(path.join(root, d.name, 'package.json')))
    if (inner) root = path.join(root, inner.name)
  }
  const pkg = readJSON(path.join(root, 'package.json'), null)
  const deps = { ...(pkg?.dependencies || {}) }
  if (!pkg || !deps.next || !deps.payload || !fs.existsSync(path.join(root, 'src', 'payload.config.ts'))) {
    fs.rmSync(tmp, { recursive: true, force: true })
    throw new Error('This does not look like an UltimaPress site: package.json or src/payload.config.ts is missing.')
  }
  for (const p of STRIP) fs.rmSync(path.join(root, p), { recursive: true, force: true })
  for (const f of fs.readdirSync(root)) if (/^\.env(\..+)?$/.test(f) && f !== '.env.example') fs.rmSync(path.join(root, f))
  // No links pointing outside the folder.
  await run('find', [root, '-type', 'l', '-delete'])
  fs.renameSync(root, dest)
  fs.rmSync(tmp, { recursive: true, force: true })
}

const install = async (dir, fromDir) => {
  const same =
    sameFile(path.join(dir, 'pnpm-lock.yaml'), path.join(fromDir, 'pnpm-lock.yaml')) &&
    sameFile(path.join(dir, 'package.json'), path.join(fromDir, 'package.json'))
  if (same && fs.existsSync(path.join(fromDir, 'node_modules'))) {
    appendLog('\nSame packages as the running version: copying them.\n')
    await run('cp', ['-a', path.join(fromDir, 'node_modules'), path.join(dir, 'node_modules')])
    return
  }
  const store = ['--store-dir', path.join(SC, 'pnpm-store')]
  const env = { ...process.env, NODE_ENV: 'development', CI: 'true' }
  try {
    await run('pnpm', ['install', '--frozen-lockfile', ...store], { cwd: dir, env })
  } catch {
    appendLog('\nThe lockfile did not match package.json: installing without it.\n')
    await run('pnpm', ['install', '--no-frozen-lockfile', ...store], { cwd: dir, env })
  }
}

const build = async (dir) => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    UP_SKIP_STATIC: '1',
    NODE_OPTIONS: '--no-deprecation',
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'build-only-secret',
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost',
  }
  // Keeps admin components registered even if that step was forgotten.
  await run(process.execPath, ['node_modules/payload/bin.js', 'generate:importmap'], { cwd: dir, env }).catch(() =>
    appendLog('\n(import map step skipped)\n'),
  )
  await run(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--experimental-build-mode', 'compile'], {
    cwd: dir,
    env,
  })
  if (!isBuilt(dir)) throw new Error('The build finished without producing a site.')
}

const cleanReleases = () => {
  const keep = new Set([state.active, state.previous].filter(Boolean))
  for (const id of fs.readdirSync(RELEASES)) {
    if (!keep.has(id.replace(/\.unpack$/, ''))) fs.rmSync(path.join(RELEASES, id), { recursive: true, force: true })
  }
  for (const id of Object.keys(state.releases || {})) if (!keep.has(id)) delete state.releases[id]
  saveState()
}

/** Stops the live site, starts `id` in its place; on failure puts `backTo` back. */
const switchTo = async (id, backTo) => {
  await stopProcess(main)
  crashes = []
  const c = startMain(id)
  try {
    await waitHealthy(PORT, c)
  } catch (e) {
    await stopProcess(c)
    startMain(backTo)
    throw e
  }
}

const deploy = async ({ id, file, by, note }) => {
  const from = state.active || null
  const fromDir = releaseDir(from)
  const dir = releaseDir(id)
  let backup = null
  let candidate = null
  let migrated = false
  try {
    setStep('backup')
    backup = await plain(backupDatabase(id), 'Your content could not be backed up, so nothing was changed.')

    setStep('unpack')
    await plain(unpack(file, dir), 'The file could not be opened. Send a zip of your site folder.')
    migrated = migrationsOf(dir) !== migrationsOf(fromDir)

    setStep('install')
    await plain(install(dir, fromDir), 'The packages the new code needs could not be installed.')

    setStep('build')
    await plain(build(dir), 'The new code did not build. The details show why.')

    setStep('check')
    candidate = startNext(dir, CANDIDATE_PORT, '127.0.0.1')
    candidate.dbTouched = true
    await waitHealthy(CANDIDATE_PORT, candidate)
    await stopProcess(candidate)
    candidate = null

    setStep('switch')
    state.releases[id] = { createdAt: new Date().toISOString(), by, note, migrated }
    try {
      await switchTo(id, from)
    } catch (e) {
      delete state.releases[id]
      throw e
    }
    state.previous = from
    state.active = id
    record({ action: 'deploy', id, by, ok: true })
    cleanReleases()
  } catch (e) {
    const started = Boolean(candidate?.dbTouched) || job.step === 'switch'
    await stopProcess(candidate)
    if (started && migrated && backup) {
      appendLog('\nThe new version had changed the database: restoring the backup.\n')
      try {
        await restoreDatabase(backup)
        await stopProcess(main)
        startMain(from)
        await waitHealthy(PORT, main).catch(() => {})
      } catch (r) {
        appendLog(`\nRestore failed: ${r.message}\nThe backup is at ${backup}\n`)
      }
    }
    fs.rmSync(dir, { recursive: true, force: true })
    fs.rmSync(`${dir}.unpack`, { recursive: true, force: true })
    record({ action: 'deploy', id, by, ok: false, error: e.message })
    throw e
  } finally {
    fs.rmSync(file, { force: true })
  }
}

const revert = async ({ id, to, restoreData, by }) => {
  const from = state.active || null
  if (!from) throw new Error('The site is already running the official version.')
  const target = to === 'official' ? null : (state.previous ?? null)
  if (target && !isBuilt(releaseDir(target))) throw new Error('The previous version is no longer on the server.')
  const changedData = migrationsOf(releaseDir(from)) !== migrationsOf(releaseDir(target))
  const before = path.join(BACKUPS, `${from}.dump`)
  if (changedData && !restoreData) {
    const e = new Error('The version you are leaving changed the database, so the content has to go back with it.')
    e.code = 'needs_data'
    throw e
  }
  if (changedData && !fs.existsSync(before)) throw new Error('The backup taken before that update is gone.')

  setStep('backup')
  await plain(backupDatabase(id), 'Your content could not be backed up, so nothing was changed.')
  setStep('switch')
  if (changedData) {
    await stopProcess(main)
    try {
      await plain(restoreDatabase(before), 'The content backup could not be restored, so the site stayed as it was.')
    } catch (e) {
      startMain(from)
      throw e
    }
  }
  await switchTo(target, from)
  state.previous = from
  state.active = target
  record({ action: 'revert', id: target || 'official', by, ok: true })
}

const startJob = (kind, params) => {
  if (job && job.state === 'running') {
    const e = new Error('An update is already running.')
    e.code = 'busy'
    throw e
  }
  const id = params.id
  job = {
    id,
    kind,
    state: 'running',
    startedAt: new Date().toISOString(),
    steps: STEPS[kind].map(([key, label]) => ({ key, label, state: 'waiting' })),
    logFile: path.join(LOGS, `${id}.log`),
    log: '',
  }
  saveStatus()
  const work = kind === 'deploy' ? deploy(params) : revert(params)
  work
    .then(() => {
      for (const s of job.steps) s.state = 'done'
      job.state = 'done'
    })
    .catch((e) => {
      for (const s of job.steps) if (s.state === 'running') s.state = 'failed'
      job.state = 'failed'
      job.error = e.message
      job.code = e.code
      appendLog(`\n${e.message}\n`)
      log(`${id}: failed: ${e.message}`)
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString()
      saveStatus()
    })
  return job
}

// ---------------------------------------------------------------- control API

const publicState = () => ({
  active: state.active || null,
  previous: state.active ? (state.previous ?? null) : undefined,
  canGoBack: Boolean(state.active),
  hasPrevious: Boolean(state.active && state.previous && isBuilt(releaseDir(state.previous))),
  release: state.active ? state.releases?.[state.active] || null : null,
  history: (state.history || []).slice(0, 8),
  job: job || readJSON(STATUS_FILE, null),
})

http
  .createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.headers['x-up-token'] !== TOKEN) return send(401, { error: 'Not allowed.' })
    try {
      if (req.method === 'GET' && req.url === '/status') return send(200, publicState())
      let raw = ''
      for await (const chunk of req) raw += chunk
      const body = raw ? JSON.parse(raw) : {}
      const id = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
      if (req.method === 'POST' && req.url === '/deploy') {
        const file = path.resolve(String(body.file || ''))
        if (!file.startsWith(INCOMING + path.sep) || !fs.existsSync(file)) return send(400, { error: 'No upload found.' })
        return send(200, { job: startJob('deploy', { id, file, by: body.by, note: body.note }) })
      }
      if (req.method === 'POST' && req.url === '/revert') {
        // Checked before the job starts, so the page can ask for confirmation.
        const from = state.active || null
        const target = body.to === 'official' ? null : (state.previous ?? null)
        if (from && !body.restoreData && migrationsOf(releaseDir(from)) !== migrationsOf(releaseDir(target))) {
          return send(409, {
            code: 'needs_data',
            error: 'That version changed the database, so going back also restores your content to how it was before that update.',
          })
        }
        return send(200, {
          job: startJob('revert', { id, to: body.to, restoreData: Boolean(body.restoreData), by: body.by }),
        })
      }
      send(404, { error: 'Unknown.' })
    } catch (e) {
      send(e.code === 'busy' ? 409 : 400, { error: e.message, code: e.code })
    }
  })
  .listen(CONTROL_PORT, '127.0.0.1')

// ---------------------------------------------------------------- start

// A job that was running when the container stopped did not finish.
const last = readJSON(STATUS_FILE, null)
if (last && last.state === 'running') {
  writeJSON(STATUS_FILE, { ...last, state: 'failed', error: 'The server restarted during this update.' })
}
if (state.active && !isBuilt(releaseDir(state.active))) {
  log(`version ${state.active} is missing: using the official version`)
  state.active = null
  saveState()
}
for (const f of fs.readdirSync(RELEASES)) if (f.endsWith('.unpack')) fs.rmSync(path.join(RELEASES, f), { recursive: true, force: true })

startMain(state.active || null)

const shutdown = async () => {
  shuttingDown = true
  await stopProcess(main, 10000)
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
