/**
 * CPMS Local Development Script: Demo Admin Password Provisioner
 *
 * Updates the password hash for the existing `admin@cpms.demo` user in MySQL `cpms_db`.
 *
 * Security & Design Rules:
 * 1. Strictly refuses to run if NODE_ENV is set to "production".
 * 2. Never accepts or prints plaintext passwords in logs, files, or stdout.
 * 3. Verifies that `admin@cpms.demo` exists and has role `Admin` prior to updating.
 * 4. Uses parameterized SQL execution and bcryptjs with 12 salt rounds.
 * 5. Supports interactive hidden prompt or temporary `DEMO_ADMIN_PASSWORD` environment variable.
 */

import readline from "node:readline";
import { Writable } from "node:stream";
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";

// 1. Refuse to run in production environments
if (process.env.NODE_ENV === "production") {
  console.error("FATAL: This script is restricted to local development environments only.");
  process.exit(1);
}

// 2. Load environment variables from .env.local safely
const loadEnv = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
if (loadEnv) {
  loadEnv(process.cwd());
}

// Re-check production flag in case it was defined in .env
if (process.env.NODE_ENV === "production") {
  console.error("FATAL: This script is restricted to local development environments only.");
  process.exit(1);
}

// 3. Import MySQL connection from existing application module
const { query, pool } = await import("../src/lib/mysql.ts");

const TARGET_EMAIL = "admin@cpms.demo";

function promptHidden(promptText) {
  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(promptText);
    muted = true;

    rl.question("", (answer) => {
      muted = false;
      process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getPassword() {
  // Option A: Provided via temporary environment variable
  const envPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (envPassword && envPassword.trim().length > 0) {
    // Clear from environment immediately after reading
    delete process.env.DEMO_ADMIN_PASSWORD;
    return envPassword.trim();
  }

  // Option B: Interactive hidden prompt in TTY
  if (process.stdin.isTTY) {
    console.log(`[CPMS Demo Provisioner] Updating password for: ${TARGET_EMAIL}`);
    const pass1 = await promptHidden("Enter new password for demo admin: ");
    if (!pass1) {
      throw new Error("Password cannot be empty.");
    }

    const pass2 = await promptHidden("Confirm new password: ");
    if (pass1 !== pass2) {
      throw new Error("Passwords do not match. Aborting.");
    }

    return pass1;
  }

  // If non-interactive and no environment variable provided
  throw new Error(
    `No password provided and terminal is non-interactive.\n` +
    `Please set the temporary DEMO_ADMIN_PASSWORD environment variable:\n` +
    `  PowerShell:\n` +
    `    $env:DEMO_ADMIN_PASSWORD="YourPassword"; npm run provision:admin; Remove-Item Env:\\DEMO_ADMIN_PASSWORD\n` +
    `  Bash:\n` +
    `    DEMO_ADMIN_PASSWORD="YourPassword" npm run provision:admin\n`
  );
}

async function main() {
  try {
    // Step A: Verify target user exists and is an Admin using parameterized SQL
    const checkSql = `
      SELECT user_id, email, role, account_status
      FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `;
    const users = await query(checkSql, [TARGET_EMAIL]);

    if (!Array.isArray(users) || users.length === 0) {
      console.error(`[ERROR] Target account "${TARGET_EMAIL}" was not found in the Users table.`);
      console.error(`Ensure the initial CPMS MySQL schema seed data has been imported into cpms_db.`);
      process.exit(1);
    }

    const targetUser = users[0];

    if (targetUser.role !== "Admin") {
      console.error(
        `[SECURITY ERROR] Target user "${TARGET_EMAIL}" has role "${targetUser.role}", not "Admin".`
      );
      console.error("This script is strictly restricted to updating the demo Admin account.");
      process.exit(1);
    }

    // Step B: Acquire password securely
    const rawPassword = await getPassword();

    if (rawPassword.length < 8) {
      console.error("[VALIDATION ERROR] Password must be at least 8 characters long.");
      process.exit(1);
    }

    if (rawPassword.length > 128) {
      console.error("[VALIDATION ERROR] Password cannot exceed 128 characters.");
      process.exit(1);
    }

    // Step C: Generate bcryptjs hash (12 salt rounds)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    // Step D: Update password_hash using parameterized SQL
    const updateSql = `
      UPDATE users
      SET password_hash = ?
      WHERE user_id = ? AND role = 'Admin' AND LOWER(email) = LOWER(?)
    `;
    const updateResult = await query(updateSql, [
      passwordHash,
      targetUser.user_id,
      TARGET_EMAIL,
    ]);

    if (updateResult && updateResult.affectedRows === 1) {
      console.log(`\n======================================================`);
      console.log(`[SUCCESS] Demo Admin account provisioned successfully!`);
      console.log(`Email:   ${TARGET_EMAIL}`);
      console.log(`Role:    ${targetUser.role}`);
      console.log(`Status:  ${targetUser.account_status || "Active"}`);
      console.log(`You can now log in at http://localhost:3000/login`);
      console.log(`======================================================\n`);
    } else {
      console.error("[ERROR] Failed to update password. No rows were affected.");
      process.exit(1);
    }
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  } finally {
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
    process.exit(0);
  }
}

main();

