process.on("SIGTERM", async () => {
  console.log(
    "[EZ MEDIA] SIGTERM received"
  );

  try {
    await closeDatabase();
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database shutdown error:",
      error.message
    );
  }

  server.close(() => {
    process.exit(0);
  });
});


process.on("SIGINT", async () => {
  console.log(
    "[EZ MEDIA] SIGINT received"
  );

  try {
    await closeDatabase();
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database shutdown error:",
      error.message
    );
  }

  server.close(() => {
    process.exit(0);
  });
});
