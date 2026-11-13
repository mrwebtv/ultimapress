import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { hasRole } from '@/access/roles'

import '../BuildFeature/build-feature.scss'
import { SiteCodeClient } from './SiteCode.client'
import './site-code.scss'

/**
 * "Site code" (/admin/site-code): download this site's code, change it with
 * Claude, put it live. Administrators only. The work is done by the supervisor
 * (docker/supervisor.mjs) through the endpoints in src/endpoints/siteCode.ts.
 */
export function SiteCodeView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const admin = req.payload.config.routes.admin || '/admin'
  if (!req.user) redirect(`${admin}/login`)
  if (!hasRole(req.user, 'admin')) redirect(admin)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <div className="up-build up-code">
          <header className="up-build__head">
            <p className="up-build__eyebrow">Build with Claude</p>
            <h1>Site code</h1>
            <p className="up-build__lead">
              Download your site&apos;s code, change it with Claude, and put it live from here. Your
              content is backed up first, and if the new version does not start, the current one
              keeps running.
            </p>
          </header>
          <SiteCodeClient />
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

export default SiteCodeView
