import { MongoClient, Db, ServerApiVersion } from 'mongodb'

const uri = process.env.MONGODB_URI!
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables')

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined
}

async function getClient(): Promise<MongoClient> {
  if (global._mongoClient) return global._mongoClient

  const client = new MongoClient(uri, options)
  try {
    await client.connect()
  } catch (err) {
    global._mongoClient = undefined
    throw err
  }
  global._mongoClient = client
  return client
}

export async function getDb(): Promise<Db> {
  const client = await getClient()
  return client.db('waiseka')
}

export default getClient
