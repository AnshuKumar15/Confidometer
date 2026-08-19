"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { saveSession } from "@/utils/auth";
import { login } from "@/utils/api";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (email.length > 254 || password.length > 128) {
      setError("Email or password exceeds maximum allowed length.");
      return;
    }

    setLoading(true);

    try {
      const data = await login({ email, password });
      saveSession({ accessToken: data.access_token, user: data.user || { email } });
      toast.success("Welcome back!");
      router.push("/upload");
    } catch (err) {
      const errorMsg = err.message || "Login failed";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card glass" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p>Sign in to continue your interview preparation and AI confidence analysis.</p>

        <label>
          Email
          <input 
            type="email" 
            value={email} 
            onChange={(event) => setEmail(event.target.value)} 
            required 
            maxLength={254}
            placeholder="name@example.com"
          />
        </label>

        <label style={{ position: "relative" }}>
          Password
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              maxLength={128}
              placeholder="Enter your password"
            />
            <div className="password-controls-right">
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button 
          className="button primary" 
          disabled={loading} 
          type="submit"
          style={{ marginTop: "24px" }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="auth-card-footer">
          Don&apos;t have an account? <Link href="/register">Sign up</Link>
        </div>
      </form>
    </div>
  );
}
