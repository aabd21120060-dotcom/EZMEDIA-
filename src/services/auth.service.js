import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import env from "../config/env.js";

import {
  findUserForLogin,
  findUserRoles,
  findUserPermissions,
  updateLoginState
} from "../repositories/auth.repository.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * AUTH SERVICE
 * ==========================================
 */

function createAccessToken(user, roles, permissions) {
  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organization_id,
      email: user.email,
      name: user.name,
      roles: roles.map((role) => role.slug),
      permissions: permissions.map(
        (permission) => permission.slug
      )
    },
    env.jwtSecret,
    {
      expiresIn: "7d"
    }
  );
}

export async function login({
  organizationId,
  email,
  password
}) {
  if (
    !organizationId ||
    !email ||
    !password
  ) {
    throw new Error(
      "ORGANIZATION_EMAIL_PASSWORD_REQUIRED"
    );
  }

  const user =
    await findUserForLogin(
      organizationId,
      email
    );

  if (!user) {
    throw new Error(
      "INVALID_CREDENTIALS"
    );
  }

  if (user.status !== "active") {
    throw new Error(
      "USER_ACCOUNT_INACTIVE"
    );
  }

  const passwordValid =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!passwordValid) {
    throw new Error(
      "INVALID_CREDENTIALS"
    );
  }

  const roles =
    await findUserRoles(user.id);

  const permissions =
    await findUserPermissions(user.id);

  const updatedUser =
    await updateLoginState(
      user.id
    );

  const accessToken =
    createAccessToken(
      updatedUser,
      roles,
      permissions
    );

  return {
    user: {
      id: updatedUser.id,
      organizationId:
        updatedUser.organization_id,
      name: updatedUser.name,
      email: updatedUser.email,
      status: updatedUser.status,
      emailVerifiedAt:
        updatedUser.email_verified_at,
      lastLoginAt:
        updatedUser.last_login_at,
      metadata:
        updatedUser.metadata
    },

    roles,

    permissions,

    accessToken,

    tokenType: "Bearer",

    expiresIn: "7d"
  };
}

export function verifyAccessToken(
  token
) {
  return jwt.verify(
    token,
    env.jwtSecret
  );
}

export async function hashPassword(
  password
) {
  return bcrypt.hash(
    password,
    12
  );
}
