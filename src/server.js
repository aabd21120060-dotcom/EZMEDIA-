import "dotenv/config";
import crypto from "node:crypto";

import app from "./app.js";

const PORT = Number(process.env.PORT || 3000);

const APP_NAME =
  process.env.APP_NAME || "AZ MEDIA";

const APP_VERSION =
  process.env.APP_VERSION || "11.0.0";


/*
|--------------------------------------------------------------------------
| Request ID Support
|--------------------------------------------------------------------------
|
| app.js يستخدم crypto.randomUUID().
| نحتفظ بالـ crypto هنا أيضًا لاستخدامات server-level المستقبلية.
|
*/

void crypto;


/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const server = app.listen(
  PORT,
  "0.0.0.0",
  (error) => {
    if (error) {
      console.error(
        "[AZ MEDIA] Failed to start server:",
        error
      );

      process.exit(1);
    }

    console.log(
      `[AZ MEDIA] ${APP_NAME} ${APP_VERSION}`
    );

    console.log(
      `[AZ MEDIA] Environment: ${
        process.env.NODE_ENV || "development"
      }`
    );

    console.log(
      `[AZ MEDIA] Server listening on port ${PORT}`
    );
  }
);


/*
|--------------------------------------------------------------------------
| Server Error
|--------------------------------------------------------------------------
*/

server.on("error", (error) => {
  console.error(
    "[AZ MEDIA] Server error:",
    error
  );

  process.exit(1);
});


/*
|--------------------------------------------------------------------------
| Graceful Shutdown
|--------------------------------------------------------------------------
*/

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `[AZ MEDIA] Received ${signal}`
  );

  console.log(
    "[AZ MEDIA] Starting graceful shutdown..."
  );

  server.close((error) => {
    if (error) {
      console.error(
        "[AZ MEDIA] HTTP server close error:",
        error
      );

      process.exit(1);
    }

    console.log(
      "[AZ MEDIA] HTTP server closed"
    );

    process.exit(0);
  });
}


/*
|--------------------------------------------------------------------------
| Process Signals
|--------------------------------------------------------------------------
*/

process.on(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  }
);

process.on(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
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
      "uncaughtException"
    );
  }
);


export { server };
