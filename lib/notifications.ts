import nodemailer from 'nodemailer'
import admin from 'firebase-admin'

type NotificationType = 'reminder' | 'inactivity'

const MESSAGES: Record<NotificationType, string> = {
  reminder: "Time to log your expenses!",
  inactivity: "It's been a while - come back and update your budget!",
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
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
  const transporter = getTransporter()
  const message = MESSAGES[type]

  await transporter.sendMail({
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

export async function sendPushNotification({
  fcmToken,
  type,
}: {
  fcmToken: string
  type: NotificationType
}) {
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
