import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { getServerSideURL } from '@/utilities/getURL'
import { getSiteSettings, mediaURL, safeColor } from '@/utilities/getSiteSettings'
import { MaintenancePage } from '@/components/MaintenancePage'

import './globals.css'

const fontHref = (fonts: (string | null | undefined)[]) => {
  const families = Array.from(new Set(fonts.filter(Boolean) as string[]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

async function isLoggedIn() {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    return Boolean(user)
  } catch {
    return false
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const settings = await getSiteSettings()

  const icon = mediaURL(settings.siteIcon)
  const primary = safeColor(settings.primaryColor, '#7B2BFF')
  const accent = safeColor(settings.accentColor, '#F21CD9')
  const headingFont = settings.headingFont || 'Manrope'
  const bodyFont = settings.bodyFont || 'Inter'
  const customCSS = (settings.customCSS || '').replace(/<\/style/gi, '')

  const showMaintenance = settings.maintenanceMode && !(await isLoggedIn())

  return (
    <html
      className={cn(GeistMono.variable)}
      data-template={settings.template || 'bright'}
      lang={settings.language || 'en'}
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontHref([headingFont, bodyFont])} />
        {icon ? (
          <link href={icon} rel="icon" />
        ) : (
          <>
            <link href="/favicon.ico" rel="icon" sizes="any" />
            <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
          </>
        )}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--up-primary:${primary};--up-accent:${accent};--up-font-heading:'${headingFont}',ui-sans-serif,system-ui,sans-serif;--up-font-body:'${bodyFont}',ui-sans-serif,system-ui,sans-serif;}`,
          }}
        />
        {customCSS && <style id="ultimapress-custom-css" dangerouslySetInnerHTML={{ __html: customCSS }} />}
      </head>
      <body>
        <Providers>
          {showMaintenance ? (
            <MaintenancePage settings={settings} />
          ) : (
            <>
              <AdminBar
                adminBarProps={{
                  preview: isEnabled,
                }}
              />
              <Header />
              {children}
              <Footer />
            </>
          )}
        </Providers>
      </body>
    </html>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const siteTitle = settings.siteTitle || 'UltimaPress'

  return {
    metadataBase: new URL(getServerSideURL()),
    title: {
      default: settings.tagline ? `${siteTitle} | ${settings.tagline}` : siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description: settings.tagline || undefined,
    openGraph: mergeOpenGraph({ siteName: siteTitle }),
    robots: settings.discourageSearchEngines ? { index: false, follow: false } : undefined,
    alternates: settings.enableRSS ? { types: { 'application/rss+xml': '/feed.xml' } } : undefined,
    twitter: {
      card: 'summary_large_image',
    },
  }
}
