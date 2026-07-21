import { ObjectId } from 'mongodb'

export type AnnouncementViewSource = 'carousel'

export interface IAnnouncementView {
  _id: ObjectId
  userId: string // matches every other user-scoped collection - session.user.id is a string, not an ObjectId
  announcementKey: string // ref announcements.key
  seenAt: Date
  dismissedAt: Date | null
  source: AnnouncementViewSource // 'carousel' for now, future-proofs other surfaces
  /** Carousel slot (0-indexed) this card occupied when first viewed. Enables drop-off analysis per §11. */
  position: number
  createdAt: Date
}
