import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import LandingPage from './LandingPage'

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <LandingPage />
}
