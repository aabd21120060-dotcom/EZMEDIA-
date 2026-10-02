import "dotenv/config";

import app from "./app.js";

import {
  checkDatabase,
  closeDatabase
} from "./config/database.js";

import { config } from "./config/env.js";


/*
|--------------------------------------------------------------------------
| Server State
|--------------------------------------------------------------------------
*/

let server;

let shuttingDown = false;


/*
|--------------------------------------------------------------------------
| Start Application
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    /*
    |--------------------------------------------------------------------------
    | Database Check
    |--------------------------------------------------------------------------
    */

    const database =
      await checkDatabase();

    console.log(
      "[AZ MEDIA] Database connected"
    );

    console.log(
      `[AZ MEDIA] Database: ${database.databaseName}`
    );


    /*
    |--------------------------------------------------------------------------
    | HTTP Server
    |--------------------------------------------------------------------------
    */

    server = app.listen(
      config.app.port,
      "0.0.0.0",
      () => {
        console.log(
          `[AZ MEDIA] ${config.app.name} ${config.app.version}`
        );

        console.log(
          `[AZ MEDIA] Environment: ${config.app.environment}`
        );

        console.log(
          `[AZ MEDIA] Server listening on port ${config.app.port}`
        );
      }
    );


    /*
    |--------------------------------------------------------------------------
    | Server Error
    |--------------------------------------------------------------------------
    */

    server.on(
      "error",
      (error) => {
        console.error(
          "[AZ MEDIA] Server error:",
          error
        );

        void shutdown(
          "server-error",
          1
        );
      }
    );

  } catch (error) {
    console.error(
      "[AZ MEDIA] Startup failed"
    );

    console.error(
      error
    );

    await closeDatabase();

    process.exit(1);
  }
}


/*
|--------------------------------------------------------------------------
| Graceful Shutdown
|--------------------------------------------------------------------------
*/

async function shutdown(
  signal,
  exitCode = 0
) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `[AZ MEDIA] Shutdown signal: ${signal}`
  );


  /*
  |--------------------------------------------------------------------------
  | Stop accepting HTTP requests
  |--------------------------------------------------------------------------
  */

  if (server) {
    await new Promise(
      (resolve) => {
        server.close(
          () => {
            console.log(
              "[AZ MEDIA] HTTP server closed"
            );

            resolve();
          }
        );
      }
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Close Database Pool
  |--------------------------------------------------------------------------
  */

  try {
    await closeDatabase();

    console.log(
      "[AZ MEDIA] Database pool closed"
    );

  } catch (error) {
    console.error(
      "[AZ MEDIA] Database shutdown error:",
      error
    );

    exitCode = 1;
  }


  console.log(
    "[AZ MEDIA] Shutdown complete"
  );

  process.exit(
    exitCode
  );
}


/*
|--------------------------------------------------------------------------
| Process Signals
|--------------------------------------------------------------------------
*/

process.on(
  "SIGTERM",
  () => {
    void shutdown(
      "SIGTERM"
    );
  }
);

process.on(
  "SIGINT",
  () => {
    void shutdown(
      "SIGINT"
    );
  }
);


/*
|--------------------------------------------------------------------------
| Unhandled Promise Rejection
|--------------------------------------------------------------------------
*/

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "[AZ MEDIA] Unhandled Promise Rejection:",
      reason
    );
  }
);


/*
|--------------------------------------------------------------------------
| Uncaught Exception
|--------------------------------------------------------------------------
*/

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "[AZ MEDIA] Uncaught Exception:",
      error
    );

    void shutdown(
      "uncaughtException",
      1
    );
  }
);


/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

void startServer();


/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

export {
  startServer,
  shutdown
};
