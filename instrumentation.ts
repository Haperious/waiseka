export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSchedulers } = await import('./lib/scheduler')
    startSchedulers()
  }
}
