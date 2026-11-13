import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { getSiteSettings, mediaURL } from '@/utilities/getSiteSettings'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const settings = await getSiteSettings()

  const navItems = footerData?.navItems || []
  const social = footerData?.social || []
  const { about, phone, email, address, hours } = footerData || {}
  const hasContact = Boolean(phone || email || address)
  const privacy =
    settings.privacyPolicyPage && typeof settings.privacyPolicyPage === 'object'
      ? settings.privacyPolicyPage
      : null

  return (
    <footer
      className="up-footer mt-auto text-white"
      style={{ background: 'color-mix(in oklab, var(--up-primary) 78%, black)' }}
    >
      <div className="container grid gap-10 py-16 md:py-20 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link className="flex items-center" href="/">
            <Logo src={mediaURL(settings.logo)} siteTitle={settings.siteTitle} />
          </Link>
          {(about || settings.tagline) && (
            <p className="max-w-sm leading-relaxed text-white/70">
              {about || settings.tagline}
            </p>
          )}
          {social.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
              {social.map((s, i) => (
                <li key={i}>
                  <a className="text-white/90 hover:text-white" href={s.url} rel="noopener noreferrer" target="_blank">
                    {s.platform}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasContact && (
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest">Contact</h3>
            <ul className="flex flex-col gap-3 text-white/70">
              {phone && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-white/50" aria-hidden />
                  <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>
                </li>
              )}
              {email && (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-white/50" aria-hidden />
                  <a className="break-all" href={`mailto:${email}`}>
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-white/50" aria-hidden />
                  <span className="whitespace-pre-line">{address}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {hours && (
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest">Opening hours</h3>
            <div className="flex gap-3 text-white/70">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-white/50" aria-hidden />
              <span className="whitespace-pre-line">{hours}</span>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest">Links</h3>
          <nav className="flex flex-col gap-3 text-white/70">
            {navItems.map(({ link }, i) => {
              return <CMSLink key={i} {...link} />
            })}
            {privacy?.slug && <Link href={`/${privacy.slug}`}>Privacy Policy</Link>}
            {settings.enableRSS && <a href="/feed.xml">RSS</a>}
          </nav>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container flex flex-col items-start justify-between gap-4 py-6 text-sm text-white/70 md:flex-row md:items-center">
          <span>
            © {new Date().getFullYear()} {settings.siteTitle}
          </span>
          {settings.enableThemeSwitcher && <ThemeSelector />}
        </div>
      </div>
    </footer>
  )
}
