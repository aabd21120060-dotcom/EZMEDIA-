import app from "./app.js";

import env from "./config/env.js";

import {
  checkDatabase,
  closeDatabase
} from "./config/database.js";

const server = app.listen(
  env.port,
  "0.0.0.0",
  async () => {
    console.log("");
    console.log("========================================");
    console.log("          EZ MEDIA 11.0");
    console.log("========================================");
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(`Port: ${env.port}`);
    console.log(`Node: ${process.version}`);
    console.log("Server: ONLINE");

    const database =
      await checkDatabase();

    console.log(
      "Database:",
      database.connected
        ? "CONNECTED"
        : database.configured
          ? "CONFIGURED BUT NOT CONNECTED"
          : "NOT CONFIGURED"
    );

    if (database.databaseName) {
      console.log(
        "Database Name:",
        database.databaseName
      );
    }

    console.log("========================================");
    console.log("");
  }
);

server.on("error", (error) => {
  console.error(
    "EZ MEDIA SERVER ERROR:",
    error
  );

  process.exit(1);
});

async function shutdown(signal) {
  console.log(
    `\nReceived ${signal}. Shutting down EZ MEDIA...`
  );

  server.close(async () => {
    try {
      await closeDatabase();

      console.log(
        "EZ MEDIA shutdown completed."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Shutdown error:",
        error
      );

      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error(
      "Forced shutdown after timeout."
    );

    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled Promise Rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);
