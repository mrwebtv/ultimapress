import React from 'react'

/** Admin login screen logo. */
export default function UltimaPressLogo() {
  return (
    <div className="up-brand-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ultimapress-logo.png" alt="" width={84} height={49} />
      <span>UltimaPress</span>
    </div>
  )
}

/** The square app icon, used in the admin header and on the dashboard. */
export function UltimaPressMark({ size = 28 }: { size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/brand/ultimapress-icon-192.png"
      alt="UltimaPress"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: Math.round(size * 0.24) }}
    />
  )
}
