import { NextResponse } from "next/server";
import { buildFeed, isKnownMovie } from "@/server/feed";
import { currentUser, ConfigError } from "@/server/session";
import { getStore } from "@/server/store";

// 4 accounts x 200 stays under Supabase's default 1,000-row read limit
const MAX_LIKES = 200;

/** Only accept requests sent by this site's own pages (defence in depth on top of sameSite cookies). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers may omit it
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

function failure(error: unknown) {
  const message = error instanceof ConfigError ? error.message : "Could not save your like. Please try again.";
  if (!(error instanceof ConfigError)) console.error("[likes]", error);
  return NextResponse.json({ error: message }, { status: error instanceof ConfigError ? 503 : 500 });
}

/** Like or unlike one movie; returns the refreshed personal feed. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const user = await currentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { movieId, liked } = (body ?? {}) as { movieId?: unknown; liked?: unknown };
  if (!isKnownMovie(movieId) || typeof liked !== "boolean") {
    return NextResponse.json({ error: "Unknown movie." }, { status: 400 });
  }

  try {
    const store = getStore();
    if (liked) {
      const mine = (await store.listAll()).filter((row) => row.userId === user.id).length;
      if (mine >= MAX_LIKES) {
        return NextResponse.json({ error: `You can like up to ${MAX_LIKES} movies.` }, { status: 400 });
      }
    }
    await store.setLike(user.id, movieId, liked);
    return NextResponse.json(await buildFeed(store, user.id));
  } catch (error) {
    return failure(error);
  }
}

/** Remove all of the signed-in user's likes ("Start over"). */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const user = await currentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    const store = getStore();
    await store.clear(user.id);
    return NextResponse.json(await buildFeed(store, user.id));
  } catch (error) {
    return failure(error);
  }
}
