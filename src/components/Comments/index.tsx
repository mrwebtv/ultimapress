import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Comment } from '@/payload-types'
import { getSiteSettings } from '@/utilities/getSiteSettings'
import { CommentForm } from './Form'

/** Approved comments for a post, threaded one level deep, plus the reply form. */
export async function Comments({ postId, allowComments }: { postId: number | string; allowComments?: boolean | null }) {
  const settings = await getSiteSettings()
  if (settings.enableComments === false || allowComments === false) return null

  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'comments',
    where: { and: [{ post: { equals: postId } }, { status: { equals: 'approved' } }] },
    sort: 'createdAt',
    limit: 500,
    depth: 0,
    overrideAccess: false,
  })

  const topLevel = docs.filter((c) => !c.parent)
  const replies = (id: Comment['id']) => docs.filter((c) => c.parent === id)

  return (
    <section className="max-w-[48rem] mx-auto mt-16 w-full" id="comments">
      <h2 className="text-2xl font-bold mb-6">
        {docs.length === 0 ? 'Leave a comment' : `${docs.length} comment${docs.length === 1 ? '' : 's'}`}
      </h2>
      <ol className="flex flex-col gap-6 mb-10">
        {topLevel.map((c) => (
          <li key={c.id}>
            <CommentItem comment={c} />
            {replies(c.id).length > 0 && (
              <ol className="mt-4 ml-6 pl-6 border-l border-border flex flex-col gap-4">
                {replies(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem comment={r} />
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      <CommentForm postId={postId} moderated={settings.moderateComments !== false} />
    </section>
  )
}

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => (
  <article className="rounded-[var(--radius)] border border-border bg-card p-5">
    <header className="flex justify-between gap-4 mb-2 text-sm">
      <strong>{comment.authorName}</strong>
      <time className="text-muted-foreground" dateTime={comment.createdAt}>
        {new Date(comment.createdAt).toLocaleDateString()}
      </time>
    </header>
    <p className="whitespace-pre-line">{comment.content}</p>
  </article>
)
