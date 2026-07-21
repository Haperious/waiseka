import { ObjectId } from 'mongodb'

export type AnnouncementTier = 'all' | 'free' | 'premium'

export interface IAnnouncement {
  _id: ObjectId
  key: string // unique, kebab-case, e.g. 'multi-account-balance'
  title: string // <= ANNOUNCEMENT_TITLE_MAX_LENGTH
  description: string // <= ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH
  imagePath: string // e.g. '/announcements/multi-account-balance.png'
  imageAlt: string // required, accessibility
  ctaLabel: string | null // null when there is no CTA
  ctaHref: string | null // null when there is no CTA; internal app route only
  publishedAt: Date
  expiresAt: Date // typically publishedAt + ANNOUNCEMENT_DEFAULT_TTL_DAYS
  isActive: boolean // manual kill switch, default true
  priority: number // default 0, higher wins ordering ties
  targetTier: AnnouncementTier
  createdAt: Date
  updatedAt: Date
}
