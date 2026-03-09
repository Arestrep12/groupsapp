import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChatShell } from "./chat-shell";

export default async function ChatPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const convexReady = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <ChatShell convexReady={convexReady} />
  );
}
