import type { Payload, SanitizedPermissions, TypedUser, VisibleEntities } from 'payload'
import { EntityType, groupNavItems } from '@payloadcms/ui/shared'
import React from 'react'

import { SpineClient } from './Spine.client'
import {
  SPINE_GROUPS,
  SPINE_NODES,
  type SpineNodeKey,
  type SpinePanel,
  type SpineRow,
  type SpineSection,
} from './nodes'

type Props = {
  payload: Payload
  permissions: SanitizedPermissions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  i18n: any
  user?: TypedUser | null
  visibleEntities?: VisibleEntities
}

/** Collections whose newest documents are listed in the panel, with a live preview. */
const PREVIEWABLE: Record<string, (slug: string) => string> = {
  pages: (slug) => (slug === 'home' ? '/' : `/${slug}`),
  posts: (slug) => `/posts/${slug}`,
}

const text = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, string>
    return v.en || Object.values(v)[0] || fallback
  }
  return fallback
}

const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/**
 * The Spine (server part): works out which node every collection and global
 * belongs to, counts what needs attention, and fetches the newest pages and posts
 * for the hover previews. Replaces Payload's default menu (admin.components.Nav).
 */
export async function Spine(props: Props) {
  const { payload, permissions, i18n, user, visibleEntities } = props
  if (!payload?.config) return null

  const admin = payload.config.routes.admin || '/admin'
  const { collections, globals } = payload.config
  const visibleCollections = visibleEntities?.collections ?? collections.map((c) => c.slug)
  const visibleGlobals = visibleEntities?.globals ?? globals.map((g) => g.slug)

  const groups = groupNavItems(
    [
      ...collections
        .filter((c) => visibleCollections.includes(c.slug))
        .map((entity) => ({ type: EntityType.collection as const, entity })),
      ...globals
        .filter((g) => visibleGlobals.includes(g.slug))
        .map((entity) => ({ type: EntityType.global as const, entity })),
    ],
    permissions,
    i18n,
  )

  const panels = new Map<SpineNodeKey, SpinePanel>()
  for (const n of SPINE_NODES) panels.set(n.key, { ...n, sections: [] })
  panels.set('settings', { key: 'settings', label: 'Settings', hint: 'Site and people', sections: [] })

  const reqUser = user ?? undefined
  const sectionJobs: Promise<void>[] = []

  for (const group of groups) {
    const nodeKey = SPINE_GROUPS[text(group.label).trim().toLowerCase()] ?? 'yours'
    const panel = panels.get(nodeKey)!
    for (const entity of group.entities) {
      const label = text(entity.label, entity.slug)
      if (entity.type === EntityType.global) {
        panel.sections.push({ key: `g-${entity.slug}`, title: label, href: `${admin}/globals/${entity.slug}`, rows: [] })
        continue
      }
      const slug = entity.slug
      const section: SpineSection = {
        key: `c-${slug}`,
        title: label,
        href: `${admin}/collections/${slug}`,
        newHref: permissions?.collections?.[slug]?.create ? `${admin}/collections/${slug}/create` : undefined,
        rows: [],
      }
      panel.sections.push(section)
      sectionJobs.push(
        (async () => {
          const res = await safe(
            () =>
              payload.count({
                collection: slug as never,
                user: reqUser,
                overrideAccess: false,
              }),
            { totalDocs: undefined as unknown as number },
          )
          section.count = res.totalDocs
          const toPath = PREVIEWABLE[slug]
          if (!toPath) return
          const recent = await safe(
            () =>
              payload.find({
                collection: slug as never,
                limit: 4,
                sort: '-updatedAt',
                depth: 0,
                draft: true,
                user: reqUser,
                overrideAccess: false,
              }),
            { docs: [] as unknown[] } as { docs: unknown[] },
          )
          section.rows = (recent.docs as Record<string, unknown>[]).map((doc): SpineRow => {
            const title = text(doc.title, 'Untitled')
            const live = doc._status !== 'draft' && typeof doc.slug === 'string'
            return {
              key: `${slug}-${doc.id}`,
              label: title,
              href: `${admin}/collections/${slug}/${doc.id}`,
              meta: live ? 'Live' : 'Draft',
              preview: { title, status: live ? 'live' : 'draft', url: live ? toPath(doc.slug as string) : null },
            }
          })
        })(),
      )
    }
  }

  // What needs you: comments waiting and form entries from the last 7 days.
  const canRead = (slug: string) => Boolean(permissions?.collections?.[slug]?.read)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [pending, entries] = await Promise.all([
    canRead('comments')
      ? safe(
          () => payload.count({ collection: 'comments', where: { status: { equals: 'pending' } }, user: reqUser, overrideAccess: false }),
          { totalDocs: 0 },
        )
      : { totalDocs: 0 },
    canRead('form-submissions')
      ? safe(
          () =>
            payload.count({
              collection: 'form-submissions',
              where: { createdAt: { greater_than: weekAgo } },
              user: reqUser,
              overrideAccess: false,
            }),
          { totalDocs: 0 },
        )
      : { totalDocs: 0 },
    ...sectionJobs,
  ])

  const grow = panels.get('grow')!
  grow.badge = pending.totalDocs + entries.totalDocs || undefined
  for (const s of grow.sections) {
    if (s.key === 'c-comments' && pending.totalDocs) s.meta = `${pending.totalDocs} waiting`
    if (s.key === 'c-form-submissions' && entries.totalDocs) s.meta = `${entries.totalDocs} this week`
  }

  const u0 = (user ?? {}) as { role?: string }
  // Built-in shortcuts that are not collections.
  panels.get('dashboard')!.sections.unshift({
    key: 'dash',
    rows: [
      { key: 'overview', label: 'Overview', href: admin },
      { key: 'site', label: 'View website', href: '/', external: true, meta: 'Opens in a new tab' },
    ],
  })
  if (permissions?.globals?.['site-settings']?.update) {
    panels.get('design')!.sections.unshift({
      key: 'site-design',
      rows: [{ key: 'look', label: 'Template, colours and fonts', href: `${admin}/globals/site-settings`, meta: 'Site Settings' }],
    })
  }
  panels.get('build')!.sections.unshift({
    key: 'claude',
    rows: [
      { key: 'bwc', label: 'Build with Claude', href: `${admin}#build-with-claude`, meta: 'Connect Claude' },
      { key: 'feature', label: 'Build a feature', href: `${admin}/build-a-feature`, meta: 'How it works' },
      ...(u0.role === 'admin'
        ? [{ key: 'code', label: 'Site code', href: `${admin}/site-code`, meta: 'Download, change, put live' }]
        : []),
    ],
  })
  const yours = panels.get('yours')!
  if (yours.sections.length) {
    yours.badge = yours.sections.length
  } else {
    yours.empty = {
      text: 'Features you build with Claude appear here: events, bookings, a shop, courses, anything.',
      href: `${admin}/build-a-feature`,
      cta: 'Build your first feature',
    }
  }

  const u = (user ?? {}) as { name?: string; email?: string; role?: string }
  return (
    <SpineClient
      admin={admin}
      panels={[...panels.values()]}
      user={{
        name: u.name || u.email || 'You',
        email: u.email || '',
        role: u.role || '',
        initial: (u.name || u.email || 'U').trim().charAt(0).toUpperCase(),
      }}
    />
  )
}

export default Spine
