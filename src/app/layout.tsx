import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CatalogProvider, type SessionInfo } from "@/components/CatalogProvider";
import { Footer, Header } from "@/components/Header";
import { buildFeed } from "@/server/feed";
import { ConfigError, currentUser } from "@/server/session";
import { getStore } from "@/server/store";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const displaySerif = Instrument_Serif({ variable: "--font-display-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "ReelMatch · Movie Recommender Lab", template: "%s · ReelMatch" },
  description:
    "Click movies you love and watch three recommenders (collaborative, content-based and hybrid) react live, using real MovieLens ratings.",
};

/** The signed-in user and their feed, or why the database could not be reached. */
async function loadSession(): Promise<{ session: SessionInfo | null; problem: string | null }> {
  let user;
  try {
    user = await currentUser();
  } catch (error) {
    return { session: null, problem: error instanceof ConfigError ? error.message : "Sign-in is unavailable." };
  }
  if (!user) return { session: null, problem: null };
  const info = { id: user.id, displayName: user.displayName };
  try {
    return { session: { user: info, feed: await buildFeed(getStore(), user.id) }, problem: null };
  } catch (error) {
    if (!(error instanceof ConfigError)) console.error("[feed]", error);
    const problem = error instanceof ConfigError ? error.message : "Your saved likes could not be loaded.";
    return { session: { user: info, feed: { likes: [], recs: [], matched: 0, appMatches: [] } }, problem };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { session, problem } = await loadSession();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Header userName={session?.user.displayName ?? null} />
        {problem && (
          <p role="alert" className="border-b border-popular/30 bg-popular/10 px-4 py-2 text-center text-sm text-ink">
            {problem}
          </p>
        )}
        <main className="flex-1">
          {session ? <CatalogProvider session={session}>{children}</CatalogProvider> : children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
