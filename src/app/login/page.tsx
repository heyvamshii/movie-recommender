import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentUser().catch(() => null)) redirect("/");
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:py-24">
      <h1 className="font-display text-4xl leading-tight">Sign in to your feed</h1>
      <p className="mt-3 text-ink-2">
        Every account keeps its own liked movies. Your recommendations come from people whose likes overlap with yours,
        including the other accounts here.
      </p>
      <LoginForm />
      <p className="mt-6 text-sm text-ink-3">
        Demo accounts: <span className="font-mono text-ink-2">user1</span>,{" "}
        <span className="font-mono text-ink-2">user2</span> (empty), <span className="font-mono text-ink-2">user3</span>{" "}
        (likes superhero and sci-fi), <span className="font-mono text-ink-2">user4</span> (likes romantic comedies).
        Ask the project owner for the demo password.
      </p>
    </div>
  );
}
