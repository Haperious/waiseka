import LandingPage from './LandingPage'

// Static on purpose: proxy.ts sends signed-in visitors on to the dashboard, so this
// page never needs the session and can be served from the CDN even on a cold start.
export default function Home() {
  return <LandingPage />
}
