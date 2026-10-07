/**
 * Stateless sessions: the cookie holds "userId.expiry.signature", signed with HMAC-SHA256
 * using SESSION_SECRET. Tampering with any part breaks the signature.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findUser, type AppUser } from "./users";

export const SESSION_COOKIE = "rm_session";
const SESSION_DAYS = 7;
const DEV_SECRET = "dev-only-secret-change-me";

export class ConfigError extends Error {}

export function sessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === "production") {
    throw new ConfigError("SESSION_SECRET is missing or shorter than 32 characters.");
  }
  return DEV_SECRET;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createToken(userId: string, secret: string, now = Date.now()): string {
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The user id inside a valid, unexpired token, else null. */
export function readToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const expected = Buffer.from(sign(`${userId}.${expires}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return null;
  return userId;
}

export async function startSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(userId, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = readToken(token, sessionSecret());
  return userId ? findUser(userId) : null;
}
