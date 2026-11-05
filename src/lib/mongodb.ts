import { MongoClient, Db, MongoClientOptions, ServerApiVersion } from "mongodb";

/**
 * MongoDB connection helper for Capstone Project Management System (CPMS).
 *
 * MongoDB is OPTIONAL. MySQL is the authoritative store; MongoDB only keeps
 * the activity timeline, submission version history and mentor feedback
 * history. When MONGODB_URI is not set the app still builds and runs, and
 * the history features are skipped (see `src/lib/activity.ts`).
 *
 * The client is created lazily on first use and cached across hot reloads
 * in development. Credentials are never logged.
 */

const defaultDbName = process.env.MONGODB_DATABASE || "cpms_nosql";

const options: MongoClientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 5000,
};

declare global {
  // Global declaration for TypeScript to allow caching across HMR in development
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/** True when a MongoDB connection string has been configured. */
export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Configuration error: Missing MONGODB_URI environment variable. Please define it in your .env.local file."
    );
  }

  const cache = process.env.NODE_ENV === "development";
  if (cache && global._mongoClientPromise) return global._mongoClientPromise;
  if (!cache && clientPromise) return clientPromise;

  const promise = new MongoClient(uri, options).connect().catch((error) => {
    // Clear cached promise on failure so subsequent requests can retry
    if (cache) delete global._mongoClientPromise;
    else clientPromise = undefined;
    throw error;
  });

  if (cache) global._mongoClientPromise = promise;
  else clientPromise = promise;
  return promise;
}

/**
 * Obtain the cached MongoClient promise.
 */
export async function getMongoClient(): Promise<MongoClient> {
  return connect();
}

/**
 * Obtain a MongoDB database instance.
 * Defaults to MONGODB_DATABASE, or the CPMS fallback database name.
 *
 * @param dbName Optional database name override
 */
export async function getMongoDb(dbName?: string): Promise<Db> {
  const client = await connect();
  return client.db(dbName || process.env.MONGODB_DATABASE || defaultDbName);
}
