'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTheme } from '@payloadcms/ui'

import type { SpineNodeKey, SpinePanel, SpineRow } from './nodes'
import './spine.scss'

const ICONS: Record<SpineNodeKey, string> = {
  dashboard: 'M3 11l9-7 9 7M5 10v10h14V10',
  write: 'M4 20h4L19 9l-4-4L4 16v4z',
  media: 'M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4',
  design:
    'M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.4 0-.8.7-1.5 1.5-1.5H17a4 4 0 004-4c0-4.4-4-8.5-9-8.5z',
  grow: 'M4 18l6-6 4 4 6-8 M14 8h6v6',
  build: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  yours: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
}

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const Sun = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
const Moon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)
const Globe = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
  </svg>
)

type User = { name: string; email: string; role: string; initial: string }
type OpenKey = SpineNodeKey | 'profile'

const isDocEdit = (path: string, admin: string) =>
  new RegExp(`^${admin}/collections/[^/]+/[^/]+$`).test(path)

/**
 * The Spine (client part): a glowing line with one node per section. Hovering a
 * node blooms its panel; hovering a page or post in the panel shows a live
 * preview of it. Profile, settings, the website link and the Bright/Dark switch
 * are fixed at the bottom. While a document is being edited the Spine fades back
 * (focus mode). On phones it becomes a single UP button.
 */
export function SpineClient({ admin, panels, user }: { admin: string; panels: SpinePanel[]; user: User }) {
  const path = usePathname() || ''
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState<OpenKey | null>(null)
  const [pinned, setPinned] = useState(false)
  const [hoverRow, setHoverRow] = useState<SpineRow | null>(null)
  const [top, setTop] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [intro, setIntro] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const bloomRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({})
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const byKey = Object.fromEntries(panels.map((p) => [p.key, p])) as Record<SpineNodeKey, SpinePanel>
  const mainNodes = panels.filter((p) => p.key !== 'settings')

  const activeKey = (() => {
    if (path === admin || path === `${admin}/`) return 'dashboard'
    for (const p of panels) {
      if (p.empty && path.startsWith(p.empty.href)) return p.key
      for (const s of p.sections) {
        if (s.href && path.startsWith(s.href)) return p.key
        for (const r of s.rows) if (!r.external && r.href !== admin && path.startsWith(r.href)) return p.key
      }
    }
    if (path.startsWith(`${admin}/account`)) return 'profile'
    return null
  })()

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const close = useCallback(() => {
    cancelClose()
    setOpen(null)
    setPinned(false)
    setHoverRow(null)
  }, [])
  const show = (key: OpenKey) => {
    cancelClose()
    if (key !== open) setHoverRow(null)
    setOpen(key)
  }

  // The light runs down the Spine once per login session, not on every page.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem('up-spine-intro')) {
        sessionStorage.setItem('up-spine-intro', '1')
        setIntro(true)
      }
    } catch {
      // Storage blocked: skip the intro.
    }
  }, [])

  const resetIntro = () => {
    try {
      sessionStorage.removeItem('up-spine-intro')
    } catch {
      // ignore
    }
  }

  // Close on navigation, Escape, or a click outside.
  useEffect(() => {
    close()
    setSheet(false)
  }, [path, close])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (close(), setSheet(false))
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [close])

  // Line the panel up with its node, kept inside the window.
  useLayoutEffect(() => {
    if (!open) return
    const node = nodeRefs.current[open]
    const bloom = bloomRef.current
    if (!node || !bloom) return
    const r = node.getBoundingClientRect()
    const h = bloom.offsetHeight
    const want = r.top + r.height / 2 - 34
    setTop(Math.max(12, Math.min(want, window.innerHeight - h - 12)))
  }, [open, hoverRow])

  const panel: SpinePanel | null =
    open === 'profile'
      ? {
          key: 'settings',
          label: user.name,
          hint: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '',
          sections: [
            {
              key: 'me',
              rows: [
                { key: 'account', label: 'Your account', href: `${admin}/account`, meta: user.email },
                { key: 'logout', label: 'Log out', href: `${admin}/logout` },
              ],
            },
          ],
        }
      : open
        ? byKey[open]
        : null

  const nodeProps = (key: OpenKey) => ({
    ref: (el: HTMLElement | null) => {
      nodeRefs.current[key] = el
    },
    onMouseEnter: () => !pinned && show(key),
    onFocus: () => show(key),
    'aria-expanded': open === key,
  })

  const renderRow = (row: SpineRow) => {
    const content = (
      <>
        <span className="up-spine__row-label">{row.label}</span>
        {row.meta && <span className={`up-spine__row-meta${row.meta === 'Draft' ? ' is-draft' : ''}`}>{row.meta}</span>}
      </>
    )
    const common = {
      // Logging out resets the intro, so the light runs again at the next login.
      onClick: row.key === 'logout' ? resetIntro : undefined,
      className: `up-spine__row${hoverRow?.key === row.key ? ' is-hot' : ''}`,
      onMouseEnter: () => setHoverRow(row),
      onFocus: () => setHoverRow(row),
    }
    return row.external ? (
      <a key={row.key} href={row.href} target="_blank" rel="noreferrer" {...common}>
        {content}
      </a>
    ) : (
      <Link key={row.key} href={row.href} prefetch={false} {...common}>
        {content}
      </Link>
    )
  }

  const renderPanelBody = (p: SpinePanel, withPreview: boolean) => (
    <>
      {p.sections.map((s) => (
        <div className="up-spine__section" key={s.key}>
          {s.title && (
            <div className="up-spine__section-head">
              <Link
                href={s.href || admin}
                prefetch={false}
                className="up-spine__section-link"
                onMouseEnter={() => withPreview && setHoverRow(null)}
              >
                <span>{s.title}</span>
                {s.meta ? (
                  <span className="up-spine__pill">{s.meta}</span>
                ) : typeof s.count === 'number' ? (
                  <span className="up-spine__count">{s.count}</span>
                ) : null}
              </Link>
              {s.newHref && (
                <Link href={s.newHref} prefetch={false} className="up-spine__new" aria-label={`New in ${s.title}`}>
                  +
                </Link>
              )}
            </div>
          )}
          {s.rows.map(renderRow)}
        </div>
      ))}
      {p.empty && (
        <div className="up-spine__empty">
          <p>{p.empty.text}</p>
          <Link href={p.empty.href} prefetch={false} className="up-spine__cta">
            {p.empty.cta}
          </Link>
        </div>
      )}
    </>
  )

  const focus = isDocEdit(path, admin)

  return (
    <aside
      ref={rootRef}
      className={`up-spine${focus ? ' is-focus' : ''}${open ? ' is-open' : ''}${intro ? ' is-intro' : ''}`}
      aria-label="Main menu"
      onMouseEnter={cancelClose}
      onMouseLeave={() => {
        if (pinned) return
        cancelClose()
        closeTimer.current = setTimeout(close, 220)
      }}
    >
      <div className="up-spine__rail">
        <Link href={admin} className="up-spine__logo" aria-label="UltimaPress dashboard" prefetch={false}>
          <img src="/brand/ultimapress-icon-192.png" alt="" width={40} height={40} />
        </Link>
        <button type="button" className="up-spine__mobile" aria-label="Open menu" onClick={() => setSheet(true)}>
          <img src="/brand/ultimapress-icon-192.png" alt="" width={52} height={52} />
        </button>

        <div className="up-spine__line-wrap">
          <span className="up-spine__line" aria-hidden="true" />
          <span className="up-spine__pulse" aria-hidden="true" />
          <ul className="up-spine__nodes">
            {mainNodes.map((p) => {
              const cls = `up-spine__node${activeKey === p.key ? ' is-active' : ''}${open === p.key ? ' is-open' : ''}`
              const inner = (
                <>
                  <span className="up-spine__dot" />
                  {p.badge ? <span className="up-spine__badge">{p.badge}</span> : null}
                  <span className="up-spine__tip">{p.label}</span>
                </>
              )
              return (
                <li key={p.key}>
                  {p.key === 'dashboard' ? (
                    <Link href={admin} prefetch={false} className={cls} aria-label={p.label} {...nodeProps(p.key)}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cls}
                      aria-label={p.label}
                      {...nodeProps(p.key)}
                      onClick={() => {
                        if (open === p.key && pinned) close()
                        else {
                          show(p.key)
                          setPinned(true)
                        }
                      }}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="up-spine__dock">
          <button
            type="button"
            className="up-spine__tool"
            aria-label={theme === 'dark' ? 'Switch to Bright mode' : 'Switch to Dark mode'}
            title={theme === 'dark' ? 'Bright mode' : 'Dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <a className="up-spine__tool" href="/" target="_blank" rel="noreferrer" aria-label="View website" title="View website">
            <Globe />
          </a>
          {byKey.settings.sections.length > 0 && (
            <button
              type="button"
              className={`up-spine__tool${activeKey === 'settings' ? ' is-active' : ''}`}
              aria-label="Settings"
              {...nodeProps('settings')}
              onClick={() => {
                show('settings')
                setPinned(true)
              }}
            >
              <Icon d={ICONS.settings} size={17} />
            </button>
          )}
          <button
            type="button"
            className={`up-spine__avatar${activeKey === 'profile' ? ' is-active' : ''}`}
            aria-label="Your profile"
            {...nodeProps('profile')}
            onClick={() => {
              show('profile')
              setPinned(true)
            }}
          >
            {user.initial}
          </button>
        </div>
      </div>

      {panel && (
        <div className="up-spine__bloom" ref={bloomRef} style={{ top }} key={open || ''}>
          <div className="up-spine__panel">
            <div className="up-spine__panel-head">
              <span className="up-spine__panel-title">
                {open !== 'profile' && <Icon d={ICONS[panel.key]} size={16} />}
                {panel.label}
              </span>
              <span className="up-spine__panel-hint">{panel.hint}</span>
            </div>
            <div className="up-spine__panel-body">{renderPanelBody(panel, true)}</div>
          </div>
          {hoverRow?.preview && (
            <div className="up-spine__preview" aria-hidden="true">
              <div className="up-spine__preview-bar">
                <i />
                <i />
                <i />
                <span>{hoverRow.preview.url || 'Not published yet'}</span>
              </div>
              {hoverRow.preview.url ? (
                <div className="up-spine__preview-frame">
                  <iframe key={hoverRow.preview.url} src={hoverRow.preview.url} title={`Preview of ${hoverRow.preview.title}`} tabIndex={-1} loading="lazy" />
                </div>
              ) : (
                <div className="up-spine__preview-draft">
                  <strong>{hoverRow.preview.title}</strong>
                  <span>Draft. Publish it to see the live preview.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sheet && (
        <div className="up-spine__sheet" role="dialog" aria-label="Menu">
          <div className="up-spine__sheet-head">
            <img src="/brand/ultimapress-icon-192.png" alt="" width={36} height={36} />
            <button type="button" className="up-spine__tool" aria-label="Close menu" onClick={() => setSheet(false)}>
              ×
            </button>
          </div>
          {[...mainNodes, byKey.settings].map((p) => (
            <details key={p.key} className="up-spine__sheet-group" open={activeKey === p.key}>
              <summary>
                <Icon d={ICONS[p.key]} size={18} />
                <span>{p.label}</span>
                {p.badge ? <span className="up-spine__badge is-inline">{p.badge}</span> : null}
              </summary>
              <div className="up-spine__panel-body">{renderPanelBody(p, false)}</div>
            </details>
          ))}
          <div className="up-spine__sheet-foot">
            <button type="button" className="up-spine__tool" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Switch colour mode">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            <Link href={`${admin}/account`} prefetch={false} className="up-spine__avatar">
              {user.initial}
            </Link>
            <Link href={`${admin}/logout`} prefetch={false} className="up-spine__cta" onClick={resetIntro}>
              Log out
            </Link>
          </div>
        </div>
      )}
    </aside>
  )
}
