/*
 * Cleaning for text people type. Plain .trim() only strips whitespace, so a name made of
 * a zero-width space (U+200B), a braille blank (U+2800) or a Hangul filler (U+3164) looked
 * filled in but showed as nothing. Client-safe: no server imports.
 */

/** Characters that show as nothing: whitespace, format characters (zero-width, BOM, bidi marks) and blank fillers. */
const INVISIBLE = '\\s\\p{Cf}\\u115F\\u1160\\u3164\\uFFA0\\u2800\\u180E'
const EDGES = new RegExp(`^[${INVISIBLE}]+|[${INVISIBLE}]+$`, 'gu')
const ANY_VISIBLE = new RegExp(`[^${INVISIBLE}\\p{Cc}]`, 'u')
// Control characters (NUL, ESC, ...). Line breaks are handled separately.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
// Left-to-right / right-to-left overrides flip how the rest of the text reads (used to
// disguise text), unlike the ordinary direction marks people need for Arabic or Hebrew
const OVERRIDES = /[‭‮]/g

/**
 * The text as it should be stored: Unicode-normalised (so "Café" typed two ways is one
 * name), control characters and direction overrides removed, invisible edges trimmed.
 * Joiners inside the text stay, so emoji like 👨‍👩‍👧 keep their shape. Single-line
 * text turns line breaks and tabs into spaces; multi-line text keeps line breaks.
 */
export function cleanUserText(value: string, { multiline = false }: { multiline?: boolean } = {}): string {
  let text = value.normalize('NFC').replace(CONTROL, '').replace(OVERRIDES, '')
  text = multiline ? text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ') : text.replace(/[\r\n\t]+/g, ' ')
  text = text.replace(EDGES, '')
  return ANY_VISIBLE.test(text) ? text : ''
}

/** True when the text shows nothing at all once invisible characters are ignored. */
export function isBlankText(value: string): boolean {
  return cleanUserText(value) === ''
}
