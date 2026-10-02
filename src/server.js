import "dotenv/config";

import app from "./app.js";

import {
  checkDatabase,
  closeDatabase
} from "./config/database.js";

import { config } from "./config/env.js";


let server = null;

let shuttingDown = false;


/*
|--------------------------------------------------------------------------
| معلومات التشغيل
|--------------------------------------------------------------------------
*/

function printStartupInfo() {

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "          EZ MEDIA 11.0"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `[EZ MEDIA] Node: ${process.version}`
  );

  console.log(
    `[EZ MEDIA] Environment: ${config.app.environment}`
  );

  console.log(
    `[EZ MEDIA] Port: ${config.app.port}`
  );

  console.log(
    `[EZ MEDIA] Database: ${
      config.database.url
        ? "configured"
        : "not configured"
    }`
  );

  console.log(
    "=========================================="
  );

}


/*
|--------------------------------------------------------------------------
| تشغيل الخادم
|--------------------------------------------------------------------------
*/

async function startServer() {

  try {

    printStartupInfo();


    /*
    |--------------------------------------------------------------------------
    | Database
    |--------------------------------------------------------------------------
    */

    let database = null;


    try {

      database =
        await checkDatabase();


      if (database.connected) {

        console.log(
          "[EZ MEDIA] PostgreSQL: CONNECTED"
        );

        console.log(
          `[EZ MEDIA] Database: ${database.databaseName}`
        );

      } else {

        console.warn(
          "[EZ MEDIA] PostgreSQL: NOT CONFIGURED"
        );

      }

    } catch (error) {

      console.error(
        "[EZ MEDIA] PostgreSQL connection error:"
      );

      console.error(
        error.message
      );

      console.warn(
        "[EZ MEDIA] سيتم تشغيل الخادم رغم مشكلة قاعدة البيانات."
      );

    }


    /*
    |--------------------------------------------------------------------------
    | HTTP Server
    |--------------------------------------------------------------------------
    */

    server =
      app.listen(

        config.app.port,

        "0.0.0.0",

        () => {

          console.log("");

          console.log(
            "=========================================="
          );

          console.log(
            "        EZ MEDIA SERVER ONLINE"
          );

          console.log(
            "=========================================="
          );

          console.log(
            `[EZ MEDIA] ${config.app.name} ${config.app.version}`
          );

          console.log(
            `[EZ MEDIA] Listening on 0.0.0.0:${config.app.port}`
          );

          console.log(
            `[EZ MEDIA] Health: /health`
          );

          console.log(
            `[EZ MEDIA] API: /api`
          );

          console.log(
            `[EZ MEDIA] Status: /api/status`
          );

          console.log(
            "=========================================="
          );

          console.log("");

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
          "[EZ MEDIA] HTTP Server Error:"
        );

        console.error(error);

        void shutdown(
          "server-error",
          1
        );

      }
    );


  } catch (error) {

    console.error(
      "[EZ MEDIA] STARTUP FAILED"
    );

    console.error(error);

    await closeDatabase();

    process.exit(1);

  }

}


/*
|--------------------------------------------------------------------------
| Shutdown
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
    `[EZ MEDIA] Shutdown: ${signal}`
  );


  /*
  |--------------------------------------------------------------------------
  | HTTP
  |--------------------------------------------------------------------------
  */

  if (server) {

    await new Promise(
      (resolve) => {

        server.close(
          () => {

            console.log(
              "[EZ MEDIA] HTTP server closed"
            );

            resolve();

          }
        );

      }
    );

  }


  /*
  |--------------------------------------------------------------------------
  | Database
  |--------------------------------------------------------------------------
  */

  try {

    await closeDatabase();

    console.log(
      "[EZ MEDIA] Database pool closed"
    );

  } catch (error) {

    console.error(
      "[EZ MEDIA] Database shutdown error:"
    );

    console.error(error);

    exitCode = 1;

  }


  console.log(
    "[EZ MEDIA] Shutdown complete"
  );


  process.exit(
    exitCode
  );

}


/*
|--------------------------------------------------------------------------
| Signals
|--------------------------------------------------------------------------
*/

process.on(
  "SIGTERM",
  () => {

    void shutdown(
      "SIGTERM",
      0
    );

  }
);


process.on(
  "SIGINT",
  () => {

    void shutdown(
      "SIGINT",
      0
    );

  }
);


/*
|--------------------------------------------------------------------------
| Unexpected errors
|--------------------------------------------------------------------------
*/

process.on(
  "unhandledRejection",
  (reason) => {

    console.error(
      "[EZ MEDIA] Unhandled Promise Rejection:"
    );

    console.error(reason);

  }
);


process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "[EZ MEDIA] Uncaught Exception:"
    );

    console.error(error);

    void shutdown(
      "uncaughtException",
      1
    );

  }
);


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

void startServer();


export {
  startServer,
  shutdown
};
