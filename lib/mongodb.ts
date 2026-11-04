import { MongoClient, Db, ServerApiVersion } from 'mongodb'

const uri = process.env.MONGODB_URI!
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables')

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// The promise is cached, not the client, so callers that arrive while the first
// connect is still in flight (e.g. startup warm-up + first request) share it
function getClient(): Promise<MongoClient> {
  global._mongoClientPromise ??= new MongoClient(uri, options).connect().catch((err) => {
    global._mongoClientPromise = undefined
    throw err
  })
  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClient()
  return client.db('waiseka')
}

export default getClient
