import type { Access, FieldAccess } from 'payload'

/**
 * UltimaPress roles, same idea as WordPress:
 * - admin: everything, including users and site settings
 * - editor: all pages, posts, media and comments
 * - author: writes and edits their own posts, uploads media
 */
export type Role = 'admin' | 'editor' | 'author'

type MaybeUser = object | null | undefined

/** True only for a real account in Users with one of the given roles. */
export const hasRole = (user: MaybeUser, ...roles: Role[]): boolean => {
  if (!user || !('role' in user)) return false
  const u = user as { role?: Role | null; collection?: string }
  if (u.collection && u.collection !== 'users') return false
  return Boolean(u.role && roles.includes(u.role))
}

export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'admin')

export const isAdminOrEditor: Access = ({ req: { user } }) => hasRole(user, 'admin', 'editor')

export const isAnyRole: Access = ({ req: { user } }) => hasRole(user, 'admin', 'editor', 'author')

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin')

/** Admins and editors can touch any post; authors only posts they are listed on. */
export const isEditorOrOwnPost: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin', 'editor')) return true
  if (user && hasRole(user, 'author')) {
    return { authors: { contains: (user as { id: number | string }).id } }
  }
  return false
}

/** Admins can manage every user; everyone else only themselves. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin')) return true
  if (user && (user as { collection?: string }).collection === 'users') {
    return { id: { equals: (user as { id: number | string }).id } }
  }
  return false
}
