/**
 * Inside a <form>, Radix Select mirrors its value into a hidden native <select>. When the
 * value changes before its option has registered (e.g. a default account pre-filled as
 * accounts load), that select falls back to "" and reports it as a change. Real picks
 * happen while the dropdown is open, so a "" arriving while closed over a set value is
 * that echo and should be ignored.
 */
export function isEmptyValueEcho(next: string, current: string, open: boolean): boolean {
  return next === '' && current !== '' && !open
}
