import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
import fs from "node:fs/promises";
import { Client } from "pg";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required");

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  const migrationsDir = new URL("../db/migrations/", import.meta.url);
  const migrations = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    const sql = await fs.readFile(new URL(migration, migrationsDir), "utf8");
    await client.query(sql);
    console.log(`Applied ${migration}`);
  }
  console.log("Database migrations completed.");
} finally {
  await client.end();
}
