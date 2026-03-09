"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export function SignOutButton() {
  const { signOut } = useClerk();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      await signOut({
        redirectUrl: "/",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      className="rounded-full border border-[#d7ddd9] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#697277] transition hover:border-[#aab8bc] hover:text-[#3a454a] disabled:opacity-60"
      disabled={isSubmitting}
      onClick={handleSignOut}
      type="button"
    >
      {isSubmitting ? "..." : "Salir"}
    </button>
  );
}
