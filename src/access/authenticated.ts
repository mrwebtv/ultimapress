import type { AccessArgs } from 'payload'

/** Logged in with a real account (not an API key used directly against the REST API). */
export const authenticated = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(user && (user as { collection?: string }).collection === 'users')
}
