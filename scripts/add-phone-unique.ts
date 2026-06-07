import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DIRECT_URL / DATABASE_URL");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  try {
    await sql`ALTER TABLE profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);`;
    console.log("Added profiles_phone_unique constraint.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      console.log("Constraint already exists — nothing to do.");
    } else {
      throw e;
    }
  } finally {
    await sql.end();
  }
}

main();
