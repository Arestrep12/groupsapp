"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function SignInForm() {
  const { fetchStatus, signIn } = useSignIn();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("jane");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signIn) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn.password({
          identifier,
          password,
        });

        if (result.error) {
          setError(getClerkErrorMessage(result.error));
          return;
        }

        if (signIn.status !== "complete") {
          setError("Clerk devolvió un flujo adicional. Revisa la configuración de autenticación.");
          return;
        }

        await signIn.finalize({
          navigate: async ({ decorateUrl }) => {
            const destination = decorateUrl("/chat");

            if (destination.startsWith("http")) {
              window.location.href = destination;
              return;
            }

            router.replace(destination);
          },
        });
        router.refresh();
      } catch (submissionError) {
        setError(getClerkErrorMessage(submissionError));
      } finally {
        setIsSubmitting(false);
      }
    });
  }

  return (
    <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
      <label className="field-shell">
        <span className="field-label">Nickname</span>
        <input
          autoComplete="username"
          className="field-input"
          name="nickname"
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="tu_nickname"
          type="text"
          value={identifier}
        />
      </label>

      <label className="field-shell">
        <span className="field-label">Contraseña</span>
        <input
          autoComplete="current-password"
          className="field-input"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Escribe tu contraseña"
          type="password"
          value={password}
        />
      </label>

      <div className="flex items-center justify-between pt-1 text-sm text-[var(--muted-strong)]">
        <label className="flex items-center gap-2">
          <input className="h-4 w-4 accent-[var(--accent-deep)]" disabled type="checkbox" />
          <span>Recordarme</span>
        </label>
        <span className="underline decoration-black/15 underline-offset-4">Clerk custom flow</span>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[#e8c5be] bg-[#fff4f1] px-4 py-3 text-sm text-[#8b4e40]">
          {error}
        </div>
      ) : null}

      <button
        className="primary-action w-full disabled:opacity-70"
        disabled={fetchStatus === "fetching" || isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Entrando..." : "Abrir chat"}
      </button>

      <div className="text-center text-sm text-[var(--muted-strong)]">
        ¿No tienes cuenta?{" "}
        <Link
          className="underline decoration-black/15 underline-offset-4 transition hover:decoration-black/40"
          href="/signup"
        >
          Crear una
        </Link>
      </div>
    </form>
  );
}

function getClerkErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "longMessage" in error &&
    typeof error.longMessage === "string"
  ) {
    return error.longMessage;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors.length > 0 &&
    typeof error.errors[0] === "object" &&
    error.errors[0] !== null &&
    "longMessage" in error.errors[0] &&
    typeof error.errors[0].longMessage === "string"
  ) {
    return error.errors[0].longMessage;
  }

  return "No fue posible iniciar sesión con Clerk.";
}
