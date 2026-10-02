import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CatalogProvider } from "@/components/CatalogProvider";
import { Footer, Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const displaySerif = Instrument_Serif({ variable: "--font-display-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "ReelMatch · Movie Recommender Lab", template: "%s · ReelMatch" },
  description:
    "Collaborative vs content-based vs hybrid movie recommendations on MovieLens, computed live in your browser and measured with precision@10, RMSE and a cold-start test.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <CatalogProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CatalogProvider>
      </body>
    </html>
  );
}
