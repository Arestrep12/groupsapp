"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function SignUpForm() {
  const { fetchStatus, signUp } = useSignUp();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signUp) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    startTransition(async () => {
      try {
        const result = await signUp.password({
          username,
          password,
        });

        if (result.error) {
          setError(getClerkErrorMessage(result.error));
          return;
        }

        if (signUp.status !== "complete") {
          setError(
            "Clerk pidió pasos extra. Para este flujo debes permitir registro simple con username y password.",
          );
          return;
        }

        await signUp.finalize({
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
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Elige tu Nickname"
          type="text"
          value={username}
        />
      </label>

      <label className="field-shell">
        <span className="field-label">Contraseña</span>
        <input
          autoComplete="new-password"
          className="field-input"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          type="password"
          value={password}
        />
      </label>

      <div className="min-h-0" id="clerk-captcha" />

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
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <div className="text-center text-sm text-[var(--muted-strong)]">
        ¿Ya tienes cuenta?{" "}
        <Link
          className="underline decoration-black/15 underline-offset-4 transition hover:decoration-black/40"
          href="/"
        >
          Inicia sesión
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

  return "No fue posible crear la cuenta en Clerk.";
}
