'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

type Step = { key: string; label: string; state: 'waiting' | 'running' | 'done' | 'failed' }
type Job = {
  id: string
  kind: 'deploy' | 'revert'
  state: 'running' | 'done' | 'failed'
  steps: Step[]
  error?: string
  log?: string
  finishedAt?: string
}
type Status = {
  available: boolean
  site?: string
  active?: string | null
  hasPrevious?: boolean
  release?: { createdAt: string; by?: string; note?: string } | null
  job?: Job | null
  staged?: { name: string; size: number; at: string } | null
  deployKey?: { createdAt: string } | null
}
type Ask =
  | { kind: 'upload'; file: File }
  | { kind: 'staged' }
  | { kind: 'revert'; to: 'previous' | 'official'; restoreData?: boolean }
  | { kind: 'key' }

const STARTER = 'Read CLAUDE.md first. Then add to my UltimaPress site: '

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const TITLES: Record<Ask['kind'], string> = {
  upload: 'Put this version live',
  staged: 'Put the update from Claude live',
  revert: 'Go back',
  key: 'Create a deploy key',
}

export function SiteCodeClient() {
  const [status, setStatus] = useState<Status | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restarting, setRestarting] = useState(false)
  const [key, setKey] = useState<{ key: string; site: string } | null>(null)
  const [copied, setCopied] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sawRunning = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/site-code/status', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setStatus(await res.json())
      setRestarting(false)
    } catch {
      // The site restarts for a few seconds when a new version takes over.
      if (sawRunning.current) setRestarting(true)
    }
  }, [])

  const running = status?.job?.state === 'running'
  if (running) sawRunning.current = true

  useEffect(() => {
    void load()
    const t = setInterval(load, running || restarting ? 2000 : 8000)
    return () => clearInterval(t)
  }, [load, running, restarting])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement('textarea')
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(what)
    setTimeout(() => setCopied(''), 1800)
  }

  const open = (next: Ask) => {
    setAsk(next)
    setPassword('')
    setError('')
  }
  const pick = (file?: File | null) => {
    if (!file) return
    if (!/\.(zip|tgz|tar\.gz)$/i.test(file.name)) {
      setAsk(null)
      setError('Choose a .zip of your site folder.')
      return
    }
    open({ kind: 'upload', file })
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!ask || !password) return
    setBusy(true)
    setError('')
    try {
      let res: Response
      if (ask.kind === 'upload') {
        const form = new FormData()
        form.append('password', password)
        form.append('file', ask.file)
        res = await fetch('/api/site-code/upload', { method: 'POST', body: form, credentials: 'include' })
      } else {
        const path = ask.kind === 'staged' ? 'deploy' : ask.kind
        const extra = ask.kind === 'revert' ? { to: ask.to, restoreData: ask.restoreData === true } : {}
        res = await fetch(`/api/site-code/${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password, ...extra }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'needs_data' && ask.kind === 'revert') {
          setAsk({ ...ask, restoreData: true })
          setError(`${data.error} Enter your password again to confirm.`)
          setPassword('')
          return
        }
        throw new Error(data.error || 'That did not work.')
      }
      if (ask.kind === 'key') setKey(data)
      setAsk(null)
      setPassword('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className="up-build__sub">Loading…</p>

  if (!status.available) {
    return (
      <section className="up-build__card">
        <h2>Not available here</h2>
        <p className="up-build__sub up-code__plain">
          Site code updates work on a site installed with Docker: the Deploy on Hostinger button or{' '}
          <code>install.sh</code>. This site is running another way (for example <code>pnpm dev</code>
          ), where you change the files directly.
        </p>
      </section>
    )
  }

  const job = status.job
  const custom = Boolean(status.active)
  const shipLine = key ? `node scripts/ship.mjs --site ${key.site} --key ${key.key}` : ''

  return (
    <>
      <p className={`up-code__now${custom ? ' is-custom' : ''}`}>
        <i aria-hidden="true" />
        {custom ? (
          <span>
            Running <strong>your own version</strong>, live since {when(status.release?.createdAt)}.
          </span>
        ) : (
          <span>
            Running the <strong>official UltimaPress</strong>, as installed.
          </span>
        )}
      </p>

      {(job?.state === 'running' || restarting) && job && (
        <section className="up-build__card up-code__job" aria-live="polite">
          <h2>{job.kind === 'deploy' ? 'Putting your new version live' : 'Going back'}</h2>
          <p className="up-build__sub">
            This takes a few minutes. Your site stays online until the last step. You can leave this
            page.
          </p>
          <ol className="up-code__progress">
            {job.steps.map((s) => (
              <li key={s.key} className={`is-${s.state}`}>
                <i aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ol>
          {restarting && <p className="up-build__sub">Restarting the site…</p>}
        </section>
      )}

      {job && job.state !== 'running' && !restarting && (
        <section className={`up-build__card up-code__result is-${job.state}`} aria-live="polite">
          {job.state === 'done' ? (
            <>
              <h2>{job.kind === 'deploy' ? 'Your new version is live' : 'Done: the site went back'}</h2>
              <p className="up-build__sub">
                Finished {when(job.finishedAt)}.{' '}
                <a className="up-build__link" href="/admin/site-code">
                  Reload the admin
                </a>{' '}
                to see it.
              </p>
            </>
          ) : (
            <>
              <h2>That update did not go live</h2>
              <p className="up-build__sub">
                Your site is still running the version it had before. Nothing was lost.
              </p>
              <p className="up-code__error">{job.error}</p>
              <details className="up-code__log">
                <summary>What happened (show this to Claude)</summary>
                <pre>{job.log}</pre>
                <button type="button" className="up-build__copy" onClick={() => copy(job.log || '', 'log')}>
                  {copied === 'log' ? 'Copied' : 'Copy'}
                </button>
              </details>
            </>
          )}
        </section>
      )}

      {status.staged && !running && (
        <section className="up-build__card up-code__staged">
          <h2>Claude sent an update</h2>
          <p className="up-build__sub">
            Received {when(status.staged.at)} ({mb(status.staged.size)}). It is not live yet.
          </p>
          <div className="up-code__row">
            <button type="button" className="up-code__primary" onClick={() => open({ kind: 'staged' })}>
              Put it live
            </button>
            <button
              type="button"
              className="up-build__copy"
              onClick={async () => {
                await fetch('/api/site-code/discard', { method: 'POST', credentials: 'include' })
                await load()
              }}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      <div className="up-code__steps">
        <section className="up-build__card">
          <span className="up-code__num">1</span>
          <h2>Download your site&apos;s code</h2>
          <p className="up-build__sub up-code__plain">
            A zip of the version that is live right now. Unzip it on your computer.
          </p>
          <a className="up-code__primary" href="/api/site-code/download">
            Download the code
          </a>
        </section>

        <section className="up-build__card">
          <span className="up-code__num">2</span>
          <h2>Change it with Claude</h2>
          <p className="up-build__sub up-code__plain">
            In the Claude desktop app, go to Code, choose the folder and start your request like
            this:
          </p>
          <div className="up-build__prompt">
            <code>{STARTER}</code>
            <button type="button" className="up-build__copy" onClick={() => copy(STARTER, 'starter')}>
              {copied === 'starter' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>

        <section className="up-build__card">
          <span className="up-code__num">3</span>
          <h2>Put it live</h2>
          <p className="up-build__sub up-code__plain">
            Tell Claude &ldquo;put it live&rdquo; (set that up below), or zip the folder and drop it
            here.
          </p>
          <label
            className={`up-code__drop${drag ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              pick(e.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.tgz,.gz"
              disabled={running}
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <strong>{running ? 'An update is running' : 'Choose a zip or drop it here'}</strong>
            <span>Leave out node_modules and .next</span>
          </label>
        </section>
      </div>

      {error && !ask && <p className="up-code__error">{error}</p>}

      <div className="up-build__grid">
        <section className="up-build__card">
          <h2>Let Claude put it live</h2>
          <p className="up-build__sub up-code__plain">
            A deploy key lets Claude send your changes here when you say &ldquo;put it live&rdquo;.
            Nothing goes live until you confirm it on this page with your password.
          </p>
          {key ? (
            <>
              <p className="up-build__sub up-code__plain">
                Paste this into Claude Code once. It is only shown now, and it works like a password.
              </p>
              <div className="up-build__prompt">
                <code title={shipLine}>{shipLine}</code>
                <button type="button" className="up-build__copy" onClick={() => copy(shipLine, 'ship')}>
                  {copied === 'ship' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="up-build__copy" onClick={() => open({ kind: 'key' })}>
                {status.deployKey ? 'Create a new deploy key' : 'Create a deploy key'}
              </button>
              {status.deployKey && (
                <p className="up-code__note">
                  A key was created {when(status.deployKey.createdAt)}. A new one replaces it.
                </p>
              )}
            </>
          )}
        </section>

        <section className="up-build__card">
          <h2>Go back</h2>
          {custom ? (
            <>
              <p className="up-build__sub up-code__plain">
                Not happy with the version that is live? Switch back. Your content is backed up
                first.
              </p>
              <div className="up-code__row">
                {status.hasPrevious && (
                  <button
                    type="button"
                    className="up-build__copy"
                    disabled={running}
                    onClick={() => open({ kind: 'revert', to: 'previous' })}
                  >
                    Previous version
                  </button>
                )}
                <button
                  type="button"
                  className="up-build__copy"
                  disabled={running}
                  onClick={() => open({ kind: 'revert', to: 'official' })}
                >
                  Official UltimaPress
                </button>
              </div>
              <p className="up-code__note">
                While your own version is live, Update in Docker Manager does not replace it.
              </p>
            </>
          ) : (
            <p className="up-build__sub up-code__plain">
              You are on the official version. Once you put your own version live, you can switch
              back here at any time.
            </p>
          )}
        </section>
      </div>

      {ask && (
        <div className="up-code__overlay" role="dialog" aria-modal="true" aria-labelledby="up-code-ask">
          <form className="up-code__dialog" onSubmit={confirm}>
            <h2 id="up-code-ask">{TITLES[ask.kind]}</h2>
            {ask.kind === 'upload' && (
              <p>
                {ask.file.name} ({mb(ask.file.size)}). Your content is backed up, then the site is
                rebuilt. It takes a few minutes.
              </p>
            )}
            {ask.kind === 'staged' && (
              <p>Your content is backed up, then the site is rebuilt. It takes a few minutes.</p>
            )}
            {ask.kind === 'revert' && (
              <p>
                {ask.to === 'official'
                  ? 'The site switches back to the official UltimaPress.'
                  : 'The site switches back to the version before this one.'}
                {ask.restoreData && ' Content added since that update will be lost.'}
              </p>
            )}
            {ask.kind === 'key' && <p>Any deploy key you created before stops working.</p>}
            <label htmlFor="up-code-password">Your password</label>
            <input
              id="up-code-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="up-code__error">{error}</p>}
            <div className="up-code__row">
              <button type="submit" className="up-code__primary" disabled={busy || !password}>
                {busy ? 'Working…' : 'Confirm'}
              </button>
              <button type="button" className="up-build__copy" onClick={() => setAsk(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
