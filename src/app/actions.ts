"use server";

import { redirect } from "next/navigation";
import { endSession, startSession, ConfigError } from "@/server/session";
import { DEMO_USERNAMES, authenticate } from "@/server/users";

export type LoginState = { error: string } | undefined;

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Slow down password guessing: at most 10 tries per account every 5 minutes. Only real account
 * names are tracked, so the map stays tiny. (Per server instance; Vercel's firewall is the next layer.)
 */
function tooManyAttempts(username: string, now = Date.now()): boolean {
  for (const [name, entry] of attempts) if (entry.resetAt < now) attempts.delete(name);
  const entry = attempts.get(username);
  if (!entry || entry.resetAt < now) {
    attempts.set(username, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password || username.length > 50 || password.length > 200) {
    return { error: "Enter your username and password." };
  }
  if (!DEMO_USERNAMES.includes(username)) return { error: "Wrong username or password." };
  if (tooManyAttempts(username)) return { error: "Too many attempts. Wait a few minutes and try again." };

  const user = authenticate(username, password);
  if (!user) return { error: "Wrong username or password." };
  try {
    await startSession(user.id);
  } catch (error) {
    return { error: error instanceof ConfigError ? error.message : "Could not sign you in." };
  }
  attempts.delete(username);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
