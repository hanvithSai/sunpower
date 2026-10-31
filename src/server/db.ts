/**
 * MongoDB connection (Mongoose) with a process-wide cache.
 *
 * Serverless functions and Next dev hot-reloads would otherwise open a new
 * connection pool per invocation and exhaust Atlas' free-tier connection limit.
 * Every service function calls `connectDB()` first; it is cheap after the first call.
 */
import mongoose, { type ClientSession } from "mongoose";

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __sunpowerMongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose.__sunpowerMongoose ?? { conn: null, promise: null };
globalForMongoose.__sunpowerMongoose = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local — see Setup.md.");
  }

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      // Generous window: on slow venue/college networks the first Atlas
      // handshake (DNS + TLS to three replica-set members) can take 15–20 s.
      serverSelectionTimeoutMS: 30_000,
      // Atlas hosts are IPv4; skipping IPv6 attempts shaves seconds off cold starts.
      family: 4,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null; // allow the next request to retry
    throw error;
  }
  return cache.conn;
}

/**
 * Run several writes atomically (e.g. "record payment -> confirm order ->
 * create pick list + installation job"). Pass `session` to EVERY query inside:
 *   Model.create([doc], { session }), Model.updateOne(filter, update, { session }),
 *   Model.findById(id).session(session)
 * Atlas and the local dev replica set (npm run db:local) both support transactions.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
