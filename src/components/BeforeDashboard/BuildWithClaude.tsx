'use client'

import React, { useState } from 'react'

import { Icon } from './icons'

type Connection = { url: string; claudeCode: string; https: boolean }

const contentIdeas = [
  'Write a blog post about our opening hours and publish it as a draft',
  'Add an FAQ section to the homepage with 5 questions customers ask',
  'Switch the site to the Dark premium template and make the accent green',
  'Approve all pending comments that are not spam',
]

const featureIdeas = [
  'Add an events section with dates, a venue and a booking button',
  'Add a team block with photos, roles and LinkedIn links',
  'Let visitors book a call and email me each booking',
]

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="up-claude__copy">
      <code title={value}>{value}</code>
      <button
        type="button"
        className="up-dash__btn up-dash__btn--small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
          } catch {
            const t = document.createElement('textarea')
            t.value = value
            document.body.appendChild(t)
            t.select()
            document.execCommand('copy')
            t.remove()
          }
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/**
 * "Build with Claude": connect Claude to this site in one click (content and settings),
 * and the short path for building brand-new features with Claude Code.
 */
export function BuildWithClaude({
  connections,
  repoUrl,
}: {
  connections: number
  repoUrl: string
}) {
  const [tab, setTab] = useState<'content' | 'features'>('content')
  const [busy, setBusy] = useState(false)
  const [conn, setConn] = useState<Connection | null>(null)
  const [error, setError] = useState('')

  async function connect() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/claude-connect', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create the connection.')
      setConn(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="up-dash__card up-claude" id="build-with-claude">
      <div className="up-claude__head">
        <span className="up-claude__logo">
          <Icon name="sparkles" />
        </span>
        <div>
          <h2 className="up-dash__h">Build with Claude</h2>
          <p>Connect Claude to this site, then just ask.</p>
        </div>
      </div>

      <div className="up-claude__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'content'}
          className={tab === 'content' ? 'is-on' : ''}
          onClick={() => setTab('content')}
        >
          Content & design
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'features'}
          className={tab === 'features' ? 'is-on' : ''}
          onClick={() => setTab('features')}
        >
          New features
        </button>
      </div>

      {tab === 'content' && (
        <div className="up-claude__body">
          {!conn ? (
            <>
              <p className="up-claude__lead">
                Claude writes pages and posts, edits your menus, changes your template and colours,
                and moderates comments, with the same permissions as your account.
              </p>
              <button
                type="button"
                className="up-claude__connect"
                onClick={connect}
                disabled={busy}
              >
                <Icon name="plug" size={18} /> {busy ? 'Connecting…' : 'Connect Claude'}
              </button>
              {connections > 0 && (
                <p className="up-claude__note">
                  {connections} connection{connections === 1 ? '' : 's'} active.{' '}
                  <a href="/admin/collections/payload-mcp-api-keys">Manage connections</a>
                </p>
              )}
            </>
          ) : (
            <>
              {!conn.https && (
                <p className="up-claude__warn">
                  Claude can only reach your site over HTTPS. Set your domain first (DOMAIN in
                  Docker Manager), then create the connection again.
                </p>
              )}
              <ol className="up-claude__steps">
                <li>
                  <strong>Copy your connection address</strong>
                  <small>Keep it private: it works like a password. It is only shown once.</small>
                  <CopyField value={conn.url} label="connection address" />
                </li>
                <li>
                  <strong>Add it to Claude</strong>
                  <small>
                    In Claude, open <b>Settings → Connectors → Add custom connector</b>, name it
                    &ldquo;UltimaPress&rdquo; and paste the address.
                  </small>
                </li>
                <li>
                  <strong>Ask for anything</strong>
                  <small>Start a new chat and describe what you want done on your site.</small>
                </li>
              </ol>
              <details className="up-claude__more">
                <summary>Using Claude Code instead?</summary>
                <CopyField value={conn.claudeCode} label="Claude Code command" />
              </details>
            </>
          )}
          {error && <p className="up-dash__error">{error}</p>}
          <div className="up-claude__ideas">
            <span>Try asking</span>
            {contentIdeas.map((i) => (
              <em key={i}>&ldquo;{i}&rdquo;</em>
            ))}
          </div>
        </div>
      )}

      {tab === 'features' && (
        <div className="up-claude__body">
          <p className="up-claude__lead">
            For something your site can&apos;t do yet, Claude Code adds it to the site itself.
            UltimaPress comes with instructions Claude reads first, so new features match your
            templates and keep working after updates.
          </p>
          <ol className="up-claude__steps">
            <li>
              <strong>Download your site&apos;s code</strong>
              <small>One click gives you a zip of your site. Unzip it on your computer.</small>
              <a className="up-dash__btn up-dash__btn--ghost up-dash__btn--small" href="/admin/site-code">
                Open Site code
              </a>
            </li>
            <li>
              <strong>Open the folder in Claude Code</strong>
              <small>In the Claude desktop app, go to Code and choose the folder.</small>
            </li>
            <li>
              <strong>Describe the feature</strong>
              <small>Start your request like this:</small>
              <CopyField
                value="Read CLAUDE.md first. Then add to my UltimaPress site: "
                label="starter prompt"
              />
            </li>
            <li>
              <strong>Put it live</strong>
              <small>
                Tell Claude &ldquo;put it live&rdquo;, then confirm with your password in Site code.
                Your content stays as it is.
              </small>
            </li>
          </ol>
          <div className="up-claude__ideas">
            <span>Ideas</span>
            {featureIdeas.map((i) => (
              <em key={i}>&ldquo;{i}&rdquo;</em>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
