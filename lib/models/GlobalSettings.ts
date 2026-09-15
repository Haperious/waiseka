import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export interface IGlobalSettings {
  _id: ObjectId
  aiEnabled: boolean
  aiQueryCap: number
  notificationsEnabled: boolean
  maintenanceMode: boolean
  updatedAt?: Date
  updatedBy?: string
}

const DEFAULTS = {
  aiEnabled: true,
  aiQueryCap: 15,
  notificationsEnabled: true,
  maintenanceMode: false,
}

// Six call sites read this single shared document. A 60s in-process cache (backstop only -
// writes call invalidateSettingsCache() so admin changes apply immediately) avoids a live
// Mongo read on every one of them.
const SETTINGS_CACHE_TTL_MS = 60_000

type SettingsCacheEntry = { settings: IGlobalSettings; expiresAt: number }

declare global {
  // eslint-disable-next-line no-var
  var _settingsCache: SettingsCacheEntry | null | undefined
}

// Stashed on `global` (like lib/mongodb.ts's client) rather than a bare module variable,
// so it survives dev-mode Fast Refresh module reloads between requests.
function getCache(): SettingsCacheEntry | null {
  return global._settingsCache ?? null
}

function setCache(entry: SettingsCacheEntry | null): void {
  global._settingsCache = entry
}

export async function getSettings(): Promise<IGlobalSettings> {
  const now = Date.now()
  const cached = getCache()
  if (cached && cached.expiresAt > now) return cached.settings

  const db = await getDb()
  const col = db.collection<IGlobalSettings>('globalsettings')
  let settings = await col.findOne({})
  if (!settings) {
    const { insertedId } = await col.insertOne({ ...DEFAULTS } as IGlobalSettings)
    settings = { ...DEFAULTS, _id: insertedId } as IGlobalSettings
  }

  setCache({ settings, expiresAt: now + SETTINGS_CACHE_TTL_MS })
  return settings
}

/** Call after any write to the globalsettings document so the next read isn't stale for up to 60s. */
export function invalidateSettingsCache(): void {
  setCache(null)
}
