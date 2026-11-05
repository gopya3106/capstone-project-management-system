import mysql from "mysql2/promise";

/**
 * Reusable MySQL connection pool module for CPMS.
 *
 * Connects to the authoritative MySQL database (`cpms_db`) using `mysql2/promise`.
 * Caches the connection pool across Hot Module Replacement (HMR) in development
 * to avoid leaking connections, and enforces parameterized SQL execution.
 */

declare global {
  // Global declaration to permit pool caching across HMR in development
  var _mysqlPool: mysql.Pool | undefined;
}

function getPool(): mysql.Pool {
  if (global._mysqlPool) {
    return global._mysqlPool;
  }

  const host = process.env.MYSQL_HOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "cpms_db";

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  if (process.env.NODE_ENV === "development") {
    global._mysqlPool = pool;
  }

  return pool;
}

export const pool = getPool();

/**
 * Executes a parameterized SQL query safely against MySQL.
 *
 * @param sql The SQL query string with `?` placeholders.
 * @param values The array of parameter values to bind.
 */
export async function query<T = unknown>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values?: any[]
): Promise<T> {
  const currentPool = getPool();
  try {
    const [results] = await currentPool.execute(sql, values);
    return results as T;
  } catch (error: unknown) {
    // Log safe error category without leaking SQL queries or credentials
    const errorType = error instanceof Error ? error.name : "MySQLError";
    const errorCode = (error as { code?: string })?.code || "UNKNOWN";
    console.error(`[MySQL Query Error] Execution failed. Code: ${errorCode}, Type: ${errorType}`);
    throw error;
  }
}

/**
 * Executes a callback within a managed MySQL transaction.
 *
 * Automatically issues BEGIN, COMMIT, and ROLLBACK (on failure),
 * and safely releases the dedicated connection back to the pool.
 */
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error: unknown) {
    await connection.rollback();
    const errorType = error instanceof Error ? error.name : "MySQLError";
    const errorCode = (error as { code?: string })?.code || "UNKNOWN";
    console.error(`[MySQL Transaction Error] Rolled back. Code: ${errorCode}, Type: ${errorType}`);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Runs a callback on one dedicated pooled connection (no transaction).
 * Needed for stored procedures that manage their own transaction and
 * return values through session variables (OUT parameters).
 */
export async function withConnection<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    return await callback(connection);
  } finally {
    connection.release();
  }
}

export default pool;
