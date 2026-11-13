import React from 'react'
import type { ServerProps } from 'payload'

import { Icon } from './icons'
import { SeedButton } from './SeedButton'
import { WordPressImporter } from './WordPressImporter'
import { BuildWithClaude } from './BuildWithClaude'
import { getServerSideURL } from '@/utilities/getURL'
import './index.scss'

const b = 'up-dash'

const timeAgo = (iso?: string | null) => {
  if (!iso) return ''
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]
  for (const [secs, name] of units) {
    const n = Math.floor(s / secs)
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

/** UltimaPress dashboard: an overview in the spirit of Hostinger hPanel. */
const BeforeDashboard = async ({ payload, user }: ServerProps) => {
  const u = (user || {}) as { role?: string; name?: string; email?: string }
  const isAdmin = u.role === 'admin'
  const isEditor = isAdmin || u.role === 'editor'
  const firstName = (u.name || u.email || 'there').split(/[\s@]/)[0]

  const userId = (user as { id?: number | string } | undefined)?.id
  const [
    settings,
    header,
    pages,
    posts,
    media,
    pending,
    submissions,
    recentPosts,
    recentPages,
    connections,
  ] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
    payload.findGlobal({ slug: 'header', depth: 0 }),
    payload.count({ collection: 'pages' }),
    payload.count({ collection: 'posts' }),
    payload.count({ collection: 'media' }),
    payload.count({ collection: 'comments', where: { status: { equals: 'pending' } } }),
    payload.count({ collection: 'form-submissions' }),
    payload.find({
      collection: 'posts',
      limit: 4,
      sort: '-updatedAt',
      depth: 0,
      draft: true,
      select: { title: true, updatedAt: true, _status: true },
    }),
    payload.find({
      collection: 'pages',
      limit: 4,
      sort: '-updatedAt',
      depth: 0,
      draft: true,
      select: { title: true, updatedAt: true, _status: true },
    }),
    userId
      ? payload.count({ collection: 'payload-mcp-api-keys', where: { user: { equals: userId } } })
      : Promise.resolve({ totalDocs: 0 }),
  ])

  let hour = new Date().getUTCHours()
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: settings.timezone || 'UTC',
      }).format(new Date()),
    )
  } catch {
    // Unknown time zone in settings: keep UTC.
  }
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const site = getServerSideURL()
  const host = site.replace(/^https?:\/\//, '')
  const live = !settings.maintenanceMode

  const steps = [
    {
      done: Boolean(settings.siteTitle && settings.siteTitle !== 'My UltimaPress Site'),
      label: 'Name your site',
      hint: 'Title, tagline and logo',
      href: '/admin/globals/site-settings',
    },
    {
      done: Boolean(settings.logo),
      label: 'Add your logo',
      hint: 'Shown in the header and footer',
      href: '/admin/globals/site-settings',
    },
    {
      done: pages.totalDocs > 0,
      label: 'Create your first page',
      hint: 'Build it from blocks',
      href: '/admin/collections/pages/create',
    },
    {
      done: (header.navItems || []).length > 0,
      label: 'Build your menu',
      hint: 'Links in the header',
      href: '/admin/globals/header',
    },
    {
      done: posts.totalDocs > 0,
      label: 'Publish a blog post',
      hint: 'Or import them from WordPress',
      href: '/admin/collections/posts/create',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const progress = Math.round((doneCount / steps.length) * 100)

  const stats = [
    { label: 'Pages', value: pages.totalDocs, icon: 'page', href: '/admin/collections/pages' },
    { label: 'Posts', value: posts.totalDocs, icon: 'post', href: '/admin/collections/posts' },
    {
      label: 'Comments to review',
      value: pending.totalDocs,
      icon: 'comment',
      href: '/admin/collections/comments?where[status][equals]=pending',
      alert: pending.totalDocs > 0,
    },
    {
      label: 'Media files',
      value: media.totalDocs,
      icon: 'media',
      href: '/admin/collections/media',
    },
    {
      label: 'Form entries',
      value: submissions.totalDocs,
      icon: 'inbox',
      href: '/admin/collections/form-submissions',
    },
  ]

  const actions = [
    { label: 'New page', icon: 'page', href: '/admin/collections/pages/create', show: isEditor },
    { label: 'New post', icon: 'post', href: '/admin/collections/posts/create', show: true },
    { label: 'Upload media', icon: 'upload', href: '/admin/collections/media/create', show: true },
    {
      label: 'Design & templates',
      icon: 'palette',
      href: '/admin/globals/site-settings',
      show: isAdmin,
    },
    { label: 'Menus', icon: 'menu', href: '/admin/globals/header', show: isAdmin },
    { label: 'Users', icon: 'users', href: '/admin/collections/users', show: isAdmin },
  ].filter((a) => a.show)

  const recent = [
    ...recentPages.docs.map((d) => ({
      ...d,
      kind: 'Page',
      href: `/admin/collections/pages/${d.id}`,
    })),
    ...recentPosts.docs.map((d) => ({
      ...d,
      kind: 'Post',
      href: `/admin/collections/posts/${d.id}`,
    })),
  ]
    .sort((a, c) => new Date(c.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  return (
    <div className={b}>
      {/* Hero: greeting, website status and key numbers */}
      <section className={`${b}__hero`}>
        <div className={`${b}__hero-glow`} aria-hidden="true" />
        <span className={`${b}__tagline`} aria-hidden="true">
          Built for what&apos;s next.
        </span>
        <div className={`${b}__hero-top`}>
          <div className={`${b}__hero-intro`}>
            <p className={`${b}__eyebrow`}>{greeting}</p>
            <h1>Welcome back, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}</h1>
            <div className={`${b}__hero-site`}>
              <strong>{settings.siteTitle || 'Your website'}</strong>
              <span className={`${b}__badge ${live ? 'is-live' : 'is-off'}`}>
                <i /> {live ? 'Live' : 'Maintenance mode'}
              </span>
              <a href={site} target="_blank" rel="noreferrer">
                {host}
              </a>
            </div>
          </div>
          <div className={`${b}__hero-actions`}>
            {isAdmin && (
              <a className={`${b}__btn ${b}__btn--glass`} href="/admin/globals/site-settings">
                Site settings
              </a>
            )}
            <a
              className={`${b}__btn ${b}__btn--white`}
              href={site}
              target="_blank"
              rel="noreferrer"
            >
              Open website <Icon name="external" size={16} />
            </a>
          </div>
        </div>
        <div className={`${b}__stats`}>
          {stats.map((s) => (
            <a key={s.label} href={s.href} className={`${b}__stat${s.alert ? ' is-alert' : ''}`}>
              <span className={`${b}__stat-icon`}>
                <Icon name={s.icon} size={18} />
              </span>
              <span>
                <span className={`${b}__stat-value`}>{s.value}</span>
                <span className={`${b}__stat-label`}>{s.label}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className={`${b}__cols ${b}__cols--even`}>
        <div className={`${b}__col`}>
          {/* Setup progress */}
          {isAdmin && (
            <section className={`${b}__card`}>
              <div className={`${b}__h-row`}>
                <h2 className={`${b}__h`}>Website setup</h2>
                <span className={`${b}__muted`}>
                  {doneCount} of {steps.length} done
                </span>
              </div>
              <div className={`${b}__progress`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <ul className={`${b}__steps`}>
                {steps.map((s) => (
                  <li key={s.label} className={s.done ? 'is-done' : ''}>
                    <span className={`${b}__step-dot`}>
                      {s.done && <Icon name="check" size={14} />}
                    </span>
                    <a href={s.href}>
                      <strong>{s.label}</strong>
                      <small>{s.hint}</small>
                    </a>
                  </li>
                ))}
              </ul>
              {pages.totalDocs === 0 && (
                <p className={`${b}__muted`}>
                  Want to see it with content first? <SeedButton /> with demo pages and posts.
                </p>
              )}
            </section>
          )}

          {!isAdmin && (
            <>
              <section className={`${b}__card`}>
                <h2 className={`${b}__h`}>Quick actions</h2>
                <div className={`${b}__actions`}>
                  {actions.map((a) => (
                    <a key={a.label} href={a.href} className={`${b}__action`}>
                      <span className={`${b}__action-icon`}>
                        <Icon name={a.icon} />
                      </span>
                      {a.label}
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
        <div className={`${b}__col`}>
          <BuildWithClaude
            connections={connections.totalDocs}
            repoUrl="https://github.com/mrwebtv/ultimapress"
          />
        </div>
      </div>

      <div className={`${b}__cols`}>
        <div className={`${b}__col`}>
          {/* Recent */}
          <section className={`${b}__card`}>
            <div className={`${b}__h-row`}>
              <h2 className={`${b}__h`}>Recently edited</h2>
              <a href="/admin/collections/posts" className={`${b}__link`}>
                All posts <Icon name="arrow" size={14} />
              </a>
            </div>
            {recent.length === 0 ? (
              <p className={`${b}__muted`}>Nothing yet. Create a page or a post to get started.</p>
            ) : (
              <ul className={`${b}__recent`}>
                {recent.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <a href={r.href}>
                      <span className={`${b}__recent-kind`}>{r.kind}</span>
                      <span className={`${b}__recent-title`}>{r.title || 'Untitled'}</span>
                      <span className={`${b}__pill ${r._status === 'published' ? 'is-live' : ''}`}>
                        {r._status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span className={`${b}__muted`}>{timeAgo(r.updatedAt)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className={`${b}__col`}>
          {isAdmin && (
            <>
              <section className={`${b}__card`}>
                <h2 className={`${b}__h`}>Quick actions</h2>
                <div className={`${b}__actions`}>
                  {actions.map((a) => (
                    <a key={a.label} href={a.href} className={`${b}__action`}>
                      <span className={`${b}__action-icon`}>
                        <Icon name={a.icon} />
                      </span>
                      {a.label}
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className={`${b}__cols`}>
          <div className={`${b}__col`}>
            <WordPressImporter />
          </div>
          <div className={`${b}__col`}>
            <section className={`${b}__card`}>
              <div className={`${b}__h-row`}>
                <h2 className={`${b}__h`}>
                  <Icon name="shield" size={18} /> Export & backups
                </h2>
              </div>
              <p className={`${b}__muted`}>
                Your database is backed up every night and your media every week, kept for 14 days.
                You can also download all your content as one file at any time.
              </p>
              <a className={`${b}__btn ${b}__btn--ghost`} href="/api/site-export">
                <Icon name="download" size={16} /> Download export
              </a>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

export default BeforeDashboard
