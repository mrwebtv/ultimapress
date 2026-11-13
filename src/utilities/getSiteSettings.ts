import type { Media, SiteSetting } from '@/payload-types'

import { getCachedGlobal } from './getGlobals'

export const defaultSiteSettings: Partial<SiteSetting> = {
  siteTitle: 'My UltimaPress Site',
  tagline: 'Just another UltimaPress site',
  template: 'bright',
  primaryColor: '#7B2BFF',
  accentColor: '#F21CD9',
  headingFont: 'Manrope',
  bodyFont: 'Inter',
  homepageDisplays: 'page',
  postsPerPage: 12,
  enableBlog: true,
  enableComments: true,
  moderateComments: true,
  enableSearch: true,
  enableRSS: true,
  enableThemeSwitcher: false,
  maintenanceMode: false,
}

/**
 * Site settings with safe defaults. Falls back to defaults when the database
 * is not reachable (for example while building the Docker image).
 */
export async function getSiteSettings(): Promise<SiteSetting> {
  try {
    const settings = await getCachedGlobal('site-settings', 1)()
    return { ...defaultSiteSettings, ...settings } as SiteSetting
  } catch {
    return defaultSiteSettings as SiteSetting
  }
}

export const mediaURL = (media: unknown): string | null => {
  if (media && typeof media === 'object' && 'url' in media) {
    return (media as Media).url || null
  }
  return null
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
export const safeColor = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value.trim()) ? value.trim() : fallback
