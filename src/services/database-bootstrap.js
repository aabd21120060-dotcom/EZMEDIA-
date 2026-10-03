import {
  isDatabaseConfigured,
  query
} from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * DATABASE BOOTSTRAP SERVICE
 * ==========================================
 */

export async function getDatabaseSummary() {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      ready: false,
      message: "DATABASE_URL is not configured"
    };
  }

  try {
    const result = await query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        NOW() AS server_time
    `);

    return {
      configured: true,
      ready: true,
      databaseName:
        result.rows[0]?.database_name || null,
      databaseUser:
        result.rows[0]?.database_user || null,
      serverTime:
        result.rows[0]?.server_time || null
    };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      message: error.message
    };
  }
}
