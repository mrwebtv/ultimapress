/**
 * The Spine: UltimaPress's admin menu.
 *
 * Every collection and global lands under one node, chosen by its `admin.group`:
 *   'Write' | 'Media' | 'Design' | 'Grow' | 'Build' | 'Settings'
 * Any other group (or none) lands in "Your features", so new features built
 * with Claude always show up somewhere. Settings sit behind the gear at the bottom.
 */
export type SpineNodeKey = 'dashboard' | 'write' | 'media' | 'design' | 'grow' | 'build' | 'yours' | 'settings'

export const SPINE_GROUPS: Record<string, SpineNodeKey> = {
  write: 'write',
  media: 'media',
  design: 'design',
  grow: 'grow',
  build: 'build',
  settings: 'settings',
  'your features': 'yours',
}

export const SPINE_NODES: { key: SpineNodeKey; label: string; hint: string }[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Home' },
  { key: 'write', label: 'Write', hint: 'Pages and posts' },
  { key: 'media', label: 'Media', hint: 'Images and files' },
  { key: 'design', label: 'Design', hint: 'Look and feel' },
  { key: 'grow', label: 'Grow', hint: 'Visitors and SEO' },
  { key: 'build', label: 'Build', hint: 'With Claude' },
  { key: 'yours', label: 'Your features', hint: 'Built with Claude' },
]

export type SpineRow = {
  key: string
  label: string
  href: string
  meta?: string
  external?: boolean
  /** Live preview of the page on the website, or a draft notice. */
  preview?: { url: string | null; title: string; status: 'live' | 'draft' }
}

export type SpineSection = {
  key: string
  title?: string
  href?: string
  count?: number
  meta?: string
  newHref?: string
  rows: SpineRow[]
}

export type SpinePanel = {
  key: SpineNodeKey
  label: string
  hint: string
  badge?: number
  sections: SpineSection[]
  empty?: { text: string; href: string; cta: string }
}
