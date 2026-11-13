'use client'

import React, { useState } from 'react'

export const CommentForm: React.FC<{ postId: number | string; moderated: boolean }> = ({
  postId,
  moderated,
}) => {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setState('sending')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: postId,
          authorName: form.get('authorName'),
          authorEmail: form.get('authorEmail'),
          content: form.get('content'),
          website: form.get('website'),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.[0]?.message || 'Something went wrong.')
      }
      setState('done')
      if (!moderated) window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="rounded-[var(--radius)] border border-border bg-card p-5">
        Thanks! {moderated ? 'Your comment will appear once it has been approved.' : ''}
      </p>
    )
  }

  const input =
    'w-full rounded-[var(--radius)] border border-input bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <input name="authorName" required maxLength={80} placeholder="Name" className={input} />
        <input
          name="authorEmail"
          type="email"
          required
          placeholder="Email (not published)"
          className={input}
        />
      </div>
      <textarea
        name="content"
        required
        maxLength={5000}
        rows={5}
        placeholder="Your comment"
        className={input}
      />
      {/* Honeypot: hidden from people, filled in by bots */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      {state === 'error' && <p className="text-destructive">{error}</p>}
      <div>
        <button type="submit" className="up-btn" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Post comment'}
        </button>
      </div>
    </form>
  )
}
