"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";

const FIELD =
  "mt-1 w-full rounded-xl border border-line-strong bg-surface-2 px-4 py-2.5 text-ink outline-none transition focus:border-hybrid";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="mt-8 space-y-4 rounded-2xl border border-line bg-surface-1 p-6">
      <label className="block text-sm text-ink-2">
        Username
        <input name="username" autoComplete="username" required maxLength={50} className={FIELD} />
      </label>
      <label className="block text-sm text-ink-2">
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} className={FIELD} />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-popular/15 px-3 py-2 text-sm text-ink">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink py-2.5 font-semibold text-bg transition hover:bg-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
