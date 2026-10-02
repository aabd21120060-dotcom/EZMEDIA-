import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query, transaction } from "../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must contain at least 32 characters"
  );
}

const ACCESS_TOKEN_EXPIRES =
  process.env.ACCESS_TOKEN_EXPIRES || "15m";

const REFRESH_TOKEN_DAYS =
  Number(process.env.REFRESH_TOKEN_DAYS || 30);

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organization_id,
      type: "access"
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES
    }
  );
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export async function registerUser({
  organizationId,
  name,
  email,
  password
}) {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  if (!name || name.length < 2) {
    throw new Error("Invalid name");
  }

  if (!email) {
    throw new Error("Email is required");
  }

  if (!password || password.length < 12) {
    throw new Error(
      "Password must contain at least 12 characters"
    );
  }

  const existing = await query(
    `
    SELECT id
    FROM users
    WHERE organization_id = $1
      AND LOWER(email) = LOWER($2)
    LIMIT 1
    `,
    [organizationId, email]
  );

  if (existing.rowCount > 0) {
    throw new Error("User already exists");
  }

  const passwordHash =
    await bcrypt.hash(password, 12);

  return transaction(async (client) => {
    const result = await client.query(
      `
      INSERT INTO users
      (
        organization_id,
        name,
        email,
        password_hash
      )
      VALUES
      ($1, $2, LOWER($3), $4)
      RETURNING
        id,
        organization_id,
        name,
        email,
        status,
        created_at
      `,
      [
        organizationId,
        name,
        email,
        passwordHash
      ]
    );

    return result.rows[0];
  });
}

export async function loginUser({
  email,
  password,
  organizationId
}) {
  const result = await query(
    `
    SELECT
      id,
      organization_id,
      name,
      email,
      password_hash,
      status
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND organization_id = $2
    LIMIT 1
    `,
    [email, organizationId]
  );

  if (result.rowCount === 0) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];

  if (user.status !== "active") {
    throw new Error("User account is not active");
  }

  const validPassword =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  await query(
    `
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = $1
    `,
    [user.id]
  );

  const accessToken =
    createAccessToken(user);

  const refreshToken =
    createRefreshToken();

  const tokenHash =
    hashToken(refreshToken);

  await query(
    `
    INSERT INTO refresh_tokens
    (
      user_id,
      token_hash,
      expires_at
    )
    VALUES
    (
      $1,
      $2,
      NOW() + ($3 || ' days')::interval
    )
    `,
    [
      user.id,
      tokenHash,
      REFRESH_TOKEN_DAYS
    ]
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      organizationId: user.organization_id,
      name: user.name,
      email: user.email
    }
  };
}

export async function refreshAccessToken(
  refreshToken
) {
  const tokenHash =
    hashToken(refreshToken);

  const result = await query(
    `
    SELECT
      rt.id,
      u.id AS user_id,
      u.organization_id,
      u.name,
      u.email,
      u.status
    FROM refresh_tokens rt
    JOIN users u
      ON u.id = rt.user_id
    WHERE rt.token_hash = $1
      AND rt.revoked_at IS NULL
      AND rt.expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Invalid or expired refresh token"
    );
  }

  const session = result.rows[0];

  if (session.status !== "active") {
    throw new Error("User account is not active");
  }

  await query(
    `
    UPDATE refresh_tokens
    SET
      revoked_at = NOW()
    WHERE id = $1
    `,
    [session.id]
  );

  const newRefreshToken =
    createRefreshToken();

  await query(
    `
    INSERT INTO refresh_tokens
    (
      user_id,
      token_hash,
      expires_at
    )
    VALUES
    (
      $1,
      $2,
      NOW() + ($3 || ' days')::interval
    )
    `,
    [
      session.user_id,
      hashToken(newRefreshToken),
      REFRESH_TOKEN_DAYS
    ]
  );

  const accessToken =
    createAccessToken({
      id: session.user_id,
      organization_id:
        session.organization_id
    });

  return {
    accessToken,
    refreshToken: newRefreshToken
  };
}
