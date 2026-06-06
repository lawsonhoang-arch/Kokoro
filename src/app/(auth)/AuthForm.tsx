"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/lib/auth-actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);
  const isSignup = mode === "signup";

  return (
    <div className="auth__card">
      <Link href="/" className="auth__brand" title="Kokoro">
        <span className="auth__mark" aria-hidden="true" />
        <span className="auth__name">kokoro</span>
      </Link>
      <h1 className="auth__title">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="auth__lede">
        {isSignup
          ? "Start organizing your lists your way."
          : "Sign in to reach your lists."}
      </p>

      <form className="auth__form" action={formAction}>
        {isSignup && (
          <div className="auth__field">
            <label className="auth__label" htmlFor="username">
              Username{" "}
              <span style={{ textTransform: "none", color: "var(--ink-faint)" }}>
                — optional, we&apos;ll pick one if you skip it
              </span>
            </label>
            <input
              className="auth__input"
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="watcher"
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              title="3–20 characters: letters, numbers, or underscores"
            />
          </div>
        )}
        <div className="auth__field">
          <label className="auth__label" htmlFor="email">
            Email
          </label>
          <input
            className="auth__input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="auth__field">
          <label className="auth__label" htmlFor="password">
            Password
          </label>
          <input
            className="auth__input"
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
          />
        </div>

        {state?.error && <div className="auth__error">{state.error}</div>}

        <button className="btn btn--primary auth__submit" type="submit" disabled={pending}>
          {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="auth__alt">
        {isSignup ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </div>
    </div>
  );
}
