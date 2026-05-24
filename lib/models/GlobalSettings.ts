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

export async function getSettings(): Promise<IGlobalSettings> {
  const db = await getDb()
  const col = db.collection<IGlobalSettings>('globalsettings')
  let settings = await col.findOne({})
  if (!settings) {
    await col.insertOne({ ...DEFAULTS } as IGlobalSettings)
    settings = await col.findOne({})
  }
  return settings!
}
