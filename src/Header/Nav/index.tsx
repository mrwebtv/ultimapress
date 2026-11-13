'use client'

import React, { useEffect, useState } from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, SearchIcon, X } from 'lucide-react'

export const HeaderNav: React.FC<{ data: HeaderType; showSearch?: boolean }> = ({
  data,
  showSearch = true,
}) => {
  const navItems = data?.navItems || []
  const button = data?.button?.label && data?.button?.url ? data.button : null
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])

  const search = showSearch && (
    <Link href="/search">
      <span className="sr-only">Search</span>
      <SearchIcon className="w-5 text-primary" />
    </Link>
  )

  return (
    <>
      {/* Wide screens: the full menu in a row. */}
      <nav className="hidden items-center gap-5 md:flex">
        {navItems.map(({ link, children }, i) => {
          const subItems = children || []
          if (subItems.length === 0) {
            return <CMSLink key={i} {...link} appearance="link" />
          }
          return (
            <div className="group relative" key={i}>
              <span className="inline-flex items-center gap-1">
                <CMSLink {...link} appearance="link" />
                <ChevronDown className="w-4 opacity-60" />
              </span>
              <div className="absolute left-0 top-full z-30 hidden pt-2 group-focus-within:block group-hover:block">
                <div className="flex min-w-48 flex-col rounded-lg border border-border bg-popover p-2 shadow-lg">
                  {subItems.map((sub, j) => (
                    <CMSLink
                      key={j}
                      {...sub.link}
                      appearance="link"
                      className="rounded-md px-3 py-2 hover:bg-muted"
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {button && (
          <a className="up-btn !px-4 !py-2 text-sm" href={button.url!}>
            {button.label}
          </a>
        )}
        {search}
      </nav>

      {/* Phones: the main button stays visible, the rest folds into a menu. */}
      <div className="flex items-center gap-4 md:hidden">
        {button && (
          <a className="up-btn !px-3 !py-1.5 text-sm" href={button.url!}>
            {button.label}
          </a>
        )}
        {navItems.length > 0 && (
          <button
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        )}
        {navItems.length === 0 && search}
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 px-4 md:hidden">
          <nav className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-popover p-3 text-foreground shadow-xl">
            {navItems.map(({ link, children }, i) => (
              <React.Fragment key={i}>
                <span onClick={() => setOpen(false)}>
                  <CMSLink {...link} appearance="link" className="block rounded-md px-3 py-3 text-lg hover:bg-muted" />
                </span>
                {(children || []).map((sub, j) => (
                  <span key={j} onClick={() => setOpen(false)}>
                    <CMSLink {...sub.link} appearance="link" className="block rounded-md py-2 pl-7 pr-3 text-muted-foreground hover:bg-muted" />
                  </span>
                ))}
              </React.Fragment>
            ))}
            {showSearch && (
              <Link className="rounded-md px-3 py-3 text-lg hover:bg-muted" href="/search">
                Search
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
