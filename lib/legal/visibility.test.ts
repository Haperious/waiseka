import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLegalPagesPublic } from './visibility'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

const { LegalLinks } = await import('@/components/legal/LegalLinks')

const FLAG = 'NEXT_PUBLIC_LEGAL_PAGES_PUBLIC'

afterEach(() => vi.unstubAllEnvs())

describe('isLegalPagesPublic', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    ['', false],
  ])('%j -> %s', (value, expected) => {
    vi.stubEnv(FLAG, value)
    expect(isLegalPagesPublic()).toBe(expected)
  })

  it('is false when the flag is unset', () => {
    vi.stubEnv(FLAG, undefined)
    expect(isLegalPagesPublic()).toBe(false)
  })
})

describe('LegalLinks', () => {
  it('renders nothing while the pages are under review', () => {
    vi.stubEnv(FLAG, 'false')
    expect(renderToStaticMarkup(createElement(LegalLinks))).toBe('')
  })

  it('links all three pages once public', () => {
    vi.stubEnv(FLAG, 'true')
    const html = renderToStaticMarkup(createElement(LegalLinks))
    expect(html).toContain('aria-label="Legal"')
    expect(html).toContain('href="/legal/privacy"')
    expect(html).toContain('href="/legal/terms"')
    expect(html).toContain('href="/security"')
  })

  it('uses full names when asked', () => {
    vi.stubEnv(FLAG, 'true')
    const html = renderToStaticMarkup(createElement(LegalLinks, { labels: 'full' }))
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('Terms of Service')
  })
})
