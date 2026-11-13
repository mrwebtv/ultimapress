import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { BuildFeatureGuide } from './Guide.client'
import './build-feature.scss'

/**
 * "Build a feature": its own admin page (/admin/build-a-feature) that walks the
 * site owner through adding something new with Claude. Linked from the Spine.
 */
export function BuildFeatureView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const admin = req.payload.config.routes.admin || '/admin'
  if (!req.user) redirect(`${admin}/login`)

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
        <div className="up-build">
          <header className="up-build__head">
            <p className="up-build__eyebrow">Built with Claude</p>
            <h1>Build your first feature</h1>
            <p className="up-build__lead">
              Describe what you want in plain English and Claude builds it into your site: events,
              bookings, a shop, courses, anything. No plugins to install or keep updated.
            </p>
          </header>
          <BuildFeatureGuide />
          <p className="up-build__foot">
            Once a feature is live it appears in the menu under <strong>Your features</strong>.
          </p>
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

export default BuildFeatureView
