export function notFoundHandler(req, res) {
  res.status(404).json({
    platform: "EZ MEDIA",
    status: 404,
    error: "NOT_FOUND",
    message: "المسار المطلوب غير موجود",
    path: req.originalUrl,
    requestId: req.requestId || null
  });
}

export function errorHandler(err, req, res, next) {
  console.error("EZ MEDIA ERROR:", err);

  const status =
    Number(err.status || err.statusCode) >= 400
      ? Number(err.status || err.statusCode)
      : 500;

  res.status(status).json({
    platform: "EZ MEDIA",
    status: "error",
    error:
      status === 500
        ? "INTERNAL_SERVER_ERROR"
        : "REQUEST_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "حدث خطأ داخلي في المنصة"
        : err.message,
    requestId: req.requestId || null
  });
}
