import type { Access } from 'payload'

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user && (user as { collection?: string }).collection === 'users') {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}
