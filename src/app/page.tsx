import { redirect } from "next/navigation";
import { DemoView } from "@/components/DemoView";
import { currentUser } from "@/server/session";

export default async function Home() {
  if (!(await currentUser().catch(() => null))) redirect("/login");
  return <DemoView />;
}
