/**
 * Local MongoDB for development and demos without Docker or internet:
 * a single-node replica set (so transactions work) on 127.0.0.1:27017.
 * Data lives in memory — run `npm run seed` after starting it.
 *
 *   npm run db:local     (keep this terminal open)
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sunpower?directConnection=true
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  const port = Number(process.env.LOCAL_MONGO_PORT ?? 27017);
  console.log("Starting local MongoDB (first run downloads the binary, ~1-2 min)...");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: "rs0", count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port }],
  });
  console.log(`\nMongoDB ready -> mongodb://127.0.0.1:${port}/sunpower?directConnection=true`);
  console.log("Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
