import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInForm } from "./sign-in-form";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/chat");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <div className="grain" />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(185,230,237,0.42),transparent_48%),radial-gradient(circle_at_top_right,rgba(243,223,180,0.28),transparent_36%)]" />

      <div className="mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-5 py-8">
        <section className="w-full max-w-[520px]">
          <div className="auth-shell rounded-[34px] border border-black/8 bg-white/88 p-3 shadow-[0_40px_100px_rgba(26,39,44,0.09)] backdrop-blur-xl">
            <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,249,0.96))] p-8 sm:p-10">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">
                  GroupsApp
                </p>
                <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none">
                  Iniciar sesión
                </h1>
              </div>

              <SignInForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
