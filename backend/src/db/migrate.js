import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "../config/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "..", "db", "schema.sql");

async function migrate() {
  const sql = readFileSync(schemaPath, "utf-8");
  await pool.query(sql);
  console.log("Schema aplicado com sucesso.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Falha ao aplicar schema:", err.message || err);
  process.exit(1);
});
