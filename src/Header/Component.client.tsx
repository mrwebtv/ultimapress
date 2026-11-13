'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
  logoSrc?: string | null
  siteTitle?: string | null
  showSearch?: boolean
}

export const HeaderClient: React.FC<HeaderClientProps> = ({
  data,
  logoSrc,
  siteTitle,
  showSearch,
}) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  return (
    <header className="container relative z-20 text-foreground" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="py-8 flex justify-between items-center gap-6">
        <Link href="/">
          <Logo loading="eager" priority="high" src={logoSrc} siteTitle={siteTitle} />
        </Link>
        <HeaderNav data={data} showSearch={showSearch} />
      </div>
    </header>
  )
}
