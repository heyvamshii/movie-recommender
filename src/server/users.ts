/**
 * Demo accounts. Only password hashes live in code (scrypt, per-hash salt); the shared demo
 * password is written in README.md. Real sign-up is out of scope for this demo.
 */
import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";

export type AppUser = { id: string; username: string; displayName: string };

const DEMO_PASSWORD_HASH =
  "scrypt$97de8c875e59af63f6d0d18af161872f$21587a47929417b1ef7c4f33fd098677421d06d5a26f84dab526fb7a87fd7146989bcf66ff72fc0896baa7165bc5d3f3b8cac678e8cbc827b03e70e1d11cce32";

const ACCOUNTS: (AppUser & { passwordHash: string })[] = ["user1", "user2", "user3", "user4"].map((name) => ({
  id: name,
  username: name,
  displayName: name,
  passwordHash: DEMO_PASSWORD_HASH,
}));

export const DEMO_USERNAMES = ACCOUNTS.map((account) => account.username);

export function findUser(id: string): AppUser | null {
  const account = ACCOUNTS.find((candidate) => candidate.id === id);
  return account ? { id: account.id, username: account.username, displayName: account.displayName } : null;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

/** Returns the user when username and password match, otherwise null. */
export function authenticate(username: string, password: string): AppUser | null {
  // usernames are public on the login page, so rejecting unknown ones early leaks nothing
  // and avoids spending a slow scrypt hash on junk requests
  const account = ACCOUNTS.find((candidate) => candidate.username === username.trim().toLowerCase());
  if (!account) return null;
  return verifyPassword(password, account.passwordHash) ? findUser(account.id) : null;
}
