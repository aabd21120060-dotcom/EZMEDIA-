import { randomUUID } from "node:crypto";

export default function requestId(req, res, next) {
  const incomingId =
    req.headers["x-request-id"];

  const id =
    typeof incomingId === "string" &&
    incomingId.trim()
      ? incomingId.trim()
      : randomUUID();

  req.requestId = id;

  res.setHeader(
    "X-Request-ID",
    id
  );

  next();
}
