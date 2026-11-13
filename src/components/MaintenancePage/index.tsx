import React from 'react'

import type { SiteSetting } from '@/payload-types'

export const MaintenancePage: React.FC<{ settings: SiteSetting }> = ({ settings }) => {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-widest opacity-60 mb-4">{settings.siteTitle}</p>
        <h1 className="up-heading text-4xl md:text-5xl font-bold mb-6">Back soon</h1>
        <p className="text-lg opacity-80">{settings.maintenanceMessage}</p>
      </div>
    </main>
  )
}
