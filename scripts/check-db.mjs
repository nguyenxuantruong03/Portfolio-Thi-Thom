import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = new Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query("select current_database() as database, current_user as user, version() as version");
  console.log(JSON.stringify({ ok: true, ...result.rows[0] }, null, 2));
} finally {
  await client.end().catch(() => {});
}
