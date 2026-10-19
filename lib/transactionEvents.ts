const EVENT_NAME = 'waiseka:transaction-saved'

// Lets the globally-mounted quick-add sheet notify whichever page is currently
// on screen that it should refetch its data, without a shared cache layer.
export function emitTransactionSaved() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function onTransactionSaved(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
