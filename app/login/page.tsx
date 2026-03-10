"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedbackType("error");
      setFeedback("Please enter your email.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setFeedbackType(null);

    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const callbackUrl = origin ? `${origin}/auth/callback?next=/admin` : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setFeedbackType("error");
      setFeedback(error.message || "Could not send login link.");
      setIsSubmitting(false);
      return;
    }

    setFeedbackType("success");
    setFeedback("Check your email for the magic login link.");
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Authentication</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Log In</h1>
        <p className="text-sm text-zinc-400">
          Use your admin email to receive a secure magic-link sign in.
        </p>
      </header>

      {callbackError && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
          The login link is invalid or expired. Request a new one below.
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            feedbackType === "success"
              ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isSubmitting ? "Sending Link..." : "Send Magic Link"}
        </button>
      </form>

      <Link href="/" className="inline-flex text-sm text-zinc-400 transition hover:text-zinc-200">
        Back to home
      </Link>
    </div>
  );
}