/**
 * "Browser on OS" for security emails. Order matters: Edge's user agent also says
 * Chrome and Safari, Chrome's also says Safari, an iPhone's says "like Mac OS X" and
 * Android's says Linux - so the more specific name is checked first.
 */
export function describeUserAgent(ua: string | null | undefined): string {
  const s = ua ?? ''
  const browser = s.includes('Edg/') || s.includes('Edge/') ? 'Edge'
    : s.includes('Firefox/') || s.includes('FxiOS/') ? 'Firefox'
    : s.includes('Chrome/') || s.includes('CriOS/') ? 'Chrome'
    : s.includes('Safari/') ? 'Safari'
    : 'Unknown browser'
  const os = s.includes('Windows') ? 'Windows'
    : s.includes('Android') ? 'Android'
    : s.includes('iPhone') || s.includes('iPad') ? 'iOS'
    : s.includes('Mac OS') || s.includes('Macintosh') ? 'macOS'
    : s.includes('Linux') ? 'Linux'
    : 'Unknown OS'
  return `${browser} on ${os}`
}
