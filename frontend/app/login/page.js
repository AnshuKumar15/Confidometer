"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession } from "@/utils/auth";
import { login } from "@/utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ email, password });
      saveSession({ accessToken: data.access_token, user: data.user || { email } });
      router.push("/upload");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card glass" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p>Sign in to run confidence analysis on your latest interview videos.</p>

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="button primary" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="auth-card-footer">
          Don&apos;t have an account? <Link href="/register">Sign up</Link>
        </div>
      </form>
    </div>
  );
}
