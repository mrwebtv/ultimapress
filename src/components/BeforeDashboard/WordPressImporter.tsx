'use client'

import React, { useState } from 'react'

type Report = {
  authors: number
  categories: number
  tags: number
  media: number
  posts: number
  pages: number
  comments: number
  redirects: number
  skipped: number
  errors: string[]
  error?: string
}

export const WordPressImporter: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setReport(null)
    try {
      const res = await fetch('/api/wp-import', {
        method: 'POST',
        body: new FormData(e.currentTarget),
        credentials: 'include',
      })
      const data = (await res.json()) as Report
      if (!res.ok) throw new Error(data.error || 'Import failed.')
      setReport(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="up-dash__card">
      <h2 className="up-dash__h">Import from WordPress</h2>
      <p className="up-dash__muted">
        In WordPress go to <strong>Tools → Export → All content</strong>, download the file, then
        upload it here. Posts, pages, media, categories, tags, authors and comments come across, and
        old URLs redirect to the new ones.
      </p>
      <form onSubmit={onSubmit} className="up-dash__form">
        <input type="file" name="file" accept=".xml,text/xml,application/xml" required />
        <label className="up-dash__muted">
          <input type="checkbox" name="downloadMedia" value="true" defaultChecked /> Copy images
          from the WordPress site
        </label>
        <button className="up-dash__btn" type="submit" disabled={busy}>
          {busy ? 'Importing… keep this tab open' : 'Start import'}
        </button>
      </form>
      {error && <p className="up-dash__error">{error}</p>}
      {report && (
        <div className="up-dash__report">
          <p>
            <strong>Done.</strong> {report.posts} posts, {report.pages} pages, {report.media} media,{' '}
            {report.categories} categories, {report.tags} tags, {report.authors} authors,{' '}
            {report.comments} comments, {report.redirects} redirects (active within a minute).{' '}
            {report.skipped} already existed and were skipped.
          </p>
          {report.errors.length > 0 && (
            <details>
              <summary>{report.errors.length} items need attention</summary>
              <ul>
                {report.errors.slice(0, 50).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
