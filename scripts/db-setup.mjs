/**
 * CPMS database setup (cross-platform, no mysql CLI needed).
 *
 * Runs db/001..004 in order (and db/seed.sql with --seed) against the MySQL
 * server configured in .env.local. Understands the DELIMITER syntax used by
 * the trigger / procedure file.
 *
 *   npm run db:setup              create or upgrade schema, views, triggers, procedures
 *   npm run db:setup -- --seed    ...and load demo data (only into an empty database)
 *   npm run db:setup -- --reset --seed   DROP the database first (asks for confirmation)
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import nextEnv from "@next/env";
import mysql from "mysql2/promise";

const loadEnv = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
if (loadEnv) loadEnv(process.cwd());

if (process.env.NODE_ENV === "production") {
  console.error("FATAL: db-setup is for local development only.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const WITH_SEED = args.has("--seed");
const RESET = args.has("--reset");
const YES = args.has("--yes");

const DB_NAME = process.env.MYSQL_DATABASE || "cpms_db";
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  console.error("FATAL: MYSQL_DATABASE may only contain letters, digits and underscores.");
  process.exit(1);
}

const DB_DIR = path.join(process.cwd(), "db");
const SCHEMA_FILES = [
  "001_core_schema.sql",
  "002_workflow_schema.sql",
  "003_views.sql",
  "004_triggers_procedures.sql",
];

/** Split a .sql file into statements, honouring DELIMITER changes. */
export function splitSql(source) {
  const statements = [];
  let delimiter = ";";
  let buffer = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    const delimMatch = trimmed.match(/^DELIMITER\s+(\S+)$/i);
    if (delimMatch) {
      delimiter = delimMatch[1];
      continue;
    }
    if (buffer.length === 0 && (trimmed === "" || trimmed.startsWith("--"))) continue;

    if (trimmed.endsWith(delimiter)) {
      buffer.push(line.slice(0, line.lastIndexOf(delimiter)));
      const stmt = buffer.join("\n").trim();
      if (stmt) statements.push(stmt);
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  const rest = buffer.join("\n").trim();
  if (rest && !rest.split("\n").every((l) => l.trim().startsWith("--") || l.trim() === "")) {
    statements.push(rest);
  }
  return statements;
}

function confirm(question) {
  if (YES) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    })
  );
}

async function runFile(conn, file) {
  const source = fs
    .readFileSync(path.join(DB_DIR, file), "utf8")
    .replace(/\bcpms_db\b/g, DB_NAME);
  const statements = splitSql(source);
  for (const [i, stmt] of statements.entries()) {
    try {
      await conn.query(stmt);
    } catch (err) {
      const preview = stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) || stmt;
      console.error(`\n✗ ${file}: statement ${i + 1} failed: ${preview.trim().slice(0, 120)}`);
      throw err;
    }
  }
  console.log(`✓ ${file} (${statements.length} statements)`);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  });

  try {
    const [[{ version }]] = await conn.query("SELECT VERSION() AS version");
    console.log(`Connected to MySQL ${version}; database \`${DB_NAME}\``);

    if (RESET) {
      const ok = await confirm(`This will DROP database \`${DB_NAME}\` and all its data. Type "yes" to continue: `);
      if (!ok) {
        console.log("Aborted.");
        return;
      }
      await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
      console.log(`✓ dropped ${DB_NAME}`);
    }

    for (const file of SCHEMA_FILES) {
      await runFile(conn, file);
    }

    if (WITH_SEED) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${DB_NAME}\`.users`);
      if (Number(n) > 0) {
        console.log(`• Skipped seed.sql: ${DB_NAME}.users already has ${n} row(s). Use --reset --seed for a clean demo database.`);
      } else {
        await runFile(conn, "seed.sql");
        console.log("  Demo accounts use the password: Cpms@2026");
      }
    }

    console.log("\nDatabase is ready.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.sqlMessage || err.message);
  process.exit(1);
});
