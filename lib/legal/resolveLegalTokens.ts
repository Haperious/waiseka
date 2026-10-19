/** Matches a `{{TOKEN_NAME}}` placeholder; group 1 is the name. */
const LEGAL_TOKEN_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g

/** Anything still shaped like a placeholder after substitution, including malformed ones like `{{ name }}`. */
const LEFTOVER_PLACEHOLDER_PATTERN = /\{\{[^}]*\}\}/g

export class MissingLegalTokenError extends Error {
  readonly tokenNames: string[]

  constructor(tokenNames: string[]) {
    super(`Legal document has unresolved placeholders: ${tokenNames.join(', ')}`)
    this.name = 'MissingLegalTokenError'
    this.tokenNames = tokenNames
  }
}

/**
 * Replace every `{{NAME}}` in the markdown with `tokens[NAME]`.
 *
 * @throws MissingLegalTokenError listing every placeholder left unresolved,
 *         so no raw `{{TOKEN}}` can ever reach the browser.
 */
export function resolveLegalTokens(markdown: string, tokens: Record<string, string>): string {
  const resolved = markdown.replace(LEGAL_TOKEN_PATTERN, (placeholder, tokenName: string) =>
    Object.hasOwn(tokens, tokenName) ? tokens[tokenName] : placeholder
  )

  const leftovers = resolved.match(LEFTOVER_PLACEHOLDER_PATTERN)
  if (leftovers) {
    throw new MissingLegalTokenError([...new Set(leftovers)])
  }

  return resolved
}
