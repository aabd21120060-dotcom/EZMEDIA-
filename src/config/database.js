import {
  pool
} from "../config/database.js";

import {
  runMigrations,
  getMigrationStatus
} from "./migrator.js";


/*
|--------------------------------------------------------------------------
| Migration Lock
|--------------------------------------------------------------------------
|
| قفل خاص بعمليات Migration الخاصة بـ AZ MEDIA.
|
| pg_advisory_lock:
| - قفل على مستوى جلسة PostgreSQL.
| - يبقى فعالًا حتى pg_advisory_unlock
|   أو انتهاء اتصال PostgreSQL.
|
*/

const MIGRATION_LOCK_KEY =
  82110411;


/*
|--------------------------------------------------------------------------
| Acquire Migration Lock
|--------------------------------------------------------------------------
*/

async function acquireMigrationLock(
  client
) {
  const result =
    await client.query(
      `
      SELECT pg_try_advisory_lock($1)
      AS locked
      `,
      [
        MIGRATION_LOCK_KEY
      ]
    );

  return Boolean(
    result.rows[0]?.locked
  );
}


/*
|--------------------------------------------------------------------------
| Release Migration Lock
|--------------------------------------------------------------------------
*/

async function releaseMigrationLock(
  client
) {
  const result =
    await client.query(
      `
      SELECT pg_advisory_unlock($1)
      AS unlocked
      `,
      [
        MIGRATION_LOCK_KEY
      ]
    );

  return Boolean(
    result.rows[0]?.unlocked
  );
}


/*
|--------------------------------------------------------------------------
| Run Migrations
|--------------------------------------------------------------------------
*/

async function main() {
  const client =
    await pool.connect();

  let lockAcquired = false;

  try {

    /*
    |--------------------------------------------------------------------------
    | Acquire Lock
    |--------------------------------------------------------------------------
    */

    lockAcquired =
      await acquireMigrationLock(
        client
      );

    if (!lockAcquired) {
      throw new Error(
        "Another AZ MEDIA migration process is already running"
      );
    }


    console.log(
      "[AZ MEDIA] Migration lock acquired"
    );


    /*
    |--------------------------------------------------------------------------
    | Run Migrations Using Same Client
    |--------------------------------------------------------------------------
    */

    const result =
      await runMigrations(
        client
      );


    /*
    |--------------------------------------------------------------------------
    | Output
    |--------------------------------------------------------------------------
    */

    console.log(
      "[AZ MEDIA] Migration result:"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  } finally {

    /*
    |--------------------------------------------------------------------------
    | Release Lock
    |--------------------------------------------------------------------------
    */

    if (lockAcquired) {

      try {

        await releaseMigrationLock(
          client
        );

        console.log(
          "[AZ MEDIA] Migration lock released"
        );

      } catch (error) {

        console.error(
          "[AZ MEDIA] Failed to release migration lock:",
          error
        );

      }
    }


    /*
    |--------------------------------------------------------------------------
    | Release Client
    |--------------------------------------------------------------------------
    */

    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| Migration Status
|--------------------------------------------------------------------------
*/

async function status() {
  const result =
    await getMigrationStatus();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/*
|--------------------------------------------------------------------------
| CLI
|--------------------------------------------------------------------------
*/

const command =
  process.argv[2] || "up";


try {

  if (
    command === "status"
  ) {

    await status();

  } else if (
    command === "up"
  ) {

    await main();

  } else {

    throw new Error(
      `Unknown migration command: ${command}`
    );

  }

} catch (error) {

  console.error(
    "[AZ MEDIA] Migration command failed"
  );

  console.error(
    error
  );

  process.exitCode = 1;

} finally {

  await pool.end();

}
