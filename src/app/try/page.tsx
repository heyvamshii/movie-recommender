import type { Metadata } from "next";
import { TryView } from "@/components/TryView";

export const metadata: Metadata = { title: "Try it yourself" };

export default function TryPage() {
  return <TryView />;
}
