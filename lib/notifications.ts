import admin from 'firebase-admin'
import { getMailTransporter } from '@/lib/email'
import { isPremium } from '@/lib/tier'
import type { IUser } from '@/lib/models/User'

type NotificationType = 'reminder' | 'inactivity'

const MESSAGES: Record<NotificationType, string> = {
  reminder: "Time to log your expenses!",
  inactivity: "It's been a while - come back and update your budget!",
}

export async function sendEmailNotification({
  to,
  name,
  type,
}: {
  to: string
  name: string
  type: NotificationType
}) {
  const message = MESSAGES[type]

  await getMailTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: type === 'reminder' ? 'Budget Reminder - Waiseka' : 'We miss you - Waiseka',
    text: `Hi ${name},\n\n${message}\n\nWaiseka`,
    html: `<p>Hi ${name},</p><p>${message}</p><p>- Waiseka</p>`,
  })
}

function initFirebase() {
  if (admin.apps.length > 0) return

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

/**
 * Send an FCM push notification.
 * Silently skips if the user is not on the premium tier.
 * Free users can still configure email frequency in settings but FCM push is premium-only.
 */
export async function sendPushNotification({
  fcmToken,
  type,
  user,
}: {
  fcmToken: string
  type: NotificationType
  user: Pick<IUser, 'tier' | 'premiumOverride'>
}) {
  if (!isPremium(user)) {
    return
  }

  initFirebase()
  const message = MESSAGES[type]

  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: 'Waiseka',
      body: message,
    },
  })
}
