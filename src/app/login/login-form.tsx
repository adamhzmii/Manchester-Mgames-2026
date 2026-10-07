"use client";

import { useActionState, useState } from "react";

import { EyeIcon, EyeOffIcon } from "@/components/icons";

import { signIn, type LoginState } from "@/lib/actions/auth";

import styles from "./login.module.css";

const INITIAL: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  // A shared password typed on a phone courtside: let people check it.
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="username"
          required
        />
      </label>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            className={`${styles.input} ${styles.passwordInput}`}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
          </button>
        </div>
      </div>

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
