import { MongoClient } from "mongodb";

// Same singleton-on-globalThis pattern as every other "one client per
// process" integration in Next.js (e.g. Prisma): without it, hot reload in
// dev and repeated server-action invocations would each open a new
// connection to Atlas instead of reusing one.
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

// Optional: the app works without MONGODB_URI, same as the other
// enrichment sources — book search just skips straight to Open Library.
export function getMongoClient(): MongoClient | null {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(uri, {
      // Each serverless instance gets its own pool; a small cap keeps a
      // burst of concurrent invocations from exhausting Atlas's (especially
      // a free-tier cluster's) total connection limit.
      maxPoolSize: 5,
      // Fail fast instead of tying up a function invocation (billed
      // GB-hours) waiting on an unreachable cluster.
      serverSelectionTimeoutMS: 5000,
    });
  }
  return globalForMongo.mongoClient;
}
