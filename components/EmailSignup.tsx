"use client";

import { FormEvent, useId, useState } from "react";

type EmailSignupVariant = "default" | "footer";

interface EmailSignupProps {
  variant?: EmailSignupVariant;
}

interface SubscribeResponse {
  success?: boolean;
  message?: string;
}

const SUCCESS_MESSAGE = "You're on the chant list.";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function EmailSignup({ variant = "default" }: EmailSignupProps) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFooterVariant = variant === "footer";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setIsError(true);
      setMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch("/api/email-subscribers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      let payload: SubscribeResponse | null = null;
      try {
        payload = (await response.json()) as SubscribeResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        setIsError(true);
        setMessage(payload?.message || "Could not join the chant list right now.");
        return;
      }

      setEmail("");
      setIsError(false);
      setMessage(SUCCESS_MESSAGE);
    } catch {
      setIsError(true);
      setMessage("Could not join the chant list right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={
        isFooterVariant
          ? "w-full max-w-md"
          : "rounded-3xl border border-zinc-800 bg-zinc-950/80 px-6 py-8"
      }
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Battle Alerts</p>
      <h3 className={`mt-2 font-semibold text-zinc-50 ${isFooterVariant ? "text-base" : "text-2xl"}`}>
        Never Miss A Chant Battle
      </h3>
      {!isFooterVariant && (
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Join the email list for fresh battle drops, rivalry matchups, and weekly fan chant highlights.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className={`mt-4 flex gap-2 ${isFooterVariant ? "flex-col sm:flex-row" : "flex-col sm:flex-row sm:items-center"}`}
      >
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="you@clubmail.com"
          className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-200"
        >
          Get Battle Alerts
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-sm ${isError ? "text-red-300" : "text-emerald-300"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
