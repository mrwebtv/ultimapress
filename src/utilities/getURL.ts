import canUseDOM from './canUseDOM'

/**
 * Public address of the site, read at runtime so one Docker image works on any domain:
 * SITE_URL, else https://DOMAIN, else NEXT_PUBLIC_SERVER_URL.
 */
export const getServerSideURL = () => {
  const runtime =
    process.env['SITE_URL'] || (process.env['DOMAIN'] ? `https://${process.env['DOMAIN']}` : '')
  return (
    runtime.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')
  )
}

export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}
